import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLocalDatabase, seedDatabase } from "../../scripts/seed-database";
import { TEST_ACCOUNTS, TEST_DATABASE_URL } from "./config";

/*
 * Préparation de la base de TEST, une fois par exécution (projet « db » de
 * Vitest, et Playwright via e2e/global-setup.ts) : migrations du dossier
 * drizzle/ puis seed des données fictives et des comptes de test. Chaque test
 * Vitest s'exécute ensuite dans une transaction annulée (test-database.ts) : il
 * part toujours de cet état.
 */
export default async function setup(): Promise<void> {
  assertLocalDatabase(TEST_DATABASE_URL);
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    try {
      await sql`select 1`;
    } catch {
      throw new Error(
        "Base de test injoignable : lancez `docker compose up -d --wait test-db` (ou définissez TEST_DATABASE_URL).",
      );
    }
    const db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedDatabase(db, {
      admin: TEST_ACCOUNTS.admin,
      manager: TEST_ACCOUNTS.manager,
    });
  } finally {
    await sql.end();
  }
}
