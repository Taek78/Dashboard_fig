import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLocalDatabase, seedDatabase } from "./seed-database";

/*
 * `npm run db:seed` (après `npm run db:migrate`) : remplit la base LOCALE de
 * développement avec les données fictives du projet et les comptes de
 * l'environnement (AUTH_BOOTSTRAP_* en admin, AUTH_MANAGER_* en gestionnaire).
 * Le remplissage lui-même est dans seed-database.ts, partagé avec les tests.
 * Hors Next : lit .env.local lui-même.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquante dans l'environnement.`);
  return value;
}

async function main(): Promise<void> {
  const url = required("DATABASE_URL");
  assertLocalDatabase(url);
  const manager =
    process.env.AUTH_MANAGER_EMAIL && process.env.AUTH_MANAGER_PASSWORD
      ? {
          email: process.env.AUTH_MANAGER_EMAIL,
          password: process.env.AUTH_MANAGER_PASSWORD,
          name: process.env.AUTH_MANAGER_NAME ?? "Gestionnaire",
        }
      : undefined;

  const sql = postgres(url, { max: 1 });
  try {
    const summary = await seedDatabase(drizzle(sql, { schema }), {
      admin: {
        email: required("AUTH_BOOTSTRAP_EMAIL"),
        password: required("AUTH_BOOTSTRAP_PASSWORD"),
        name: process.env.AUTH_BOOTSTRAP_NAME ?? "Administrateur",
      },
      manager,
    });
    console.info(`[seed] ${summary}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    "[seed] échec :",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
