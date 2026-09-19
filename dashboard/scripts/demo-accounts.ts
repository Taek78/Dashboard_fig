import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { eq, sql as raw } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { passwordProblems } from "@/domain/auth/password-policy";
import type { Role } from "@/domain/auth/roles";
import { splitFullName } from "@/domain/auth/rules";
import { databaseHost, remoteDatabaseProblem } from "@/lib/database-url";
import { hashPassword } from "@/lib/password";

/*
 * `npm run db:demo-accounts` : crée (ou remet à jour) deux comptes de
 * DÉMONSTRATION dans la base LOCALE, sans rien effacer d'autre :
 * - « Livreur Démo », rôle livreur : AUTH_DEMO_DRIVER_EMAIL + _PASSWORD ;
 * - « Lecture Démo », rôle lecture seule : AUTH_DEMO_READER_EMAIL + _PASSWORD.
 * Les mots de passe viennent de .env.local et sont choisis par la personne :
 * ce script n'en invente ni n'en affiche aucun. Ils passent la politique des
 * mots de passe (règles pures ; la vérification des fuites connues n'est
 * faite qu'à l'écran). Un compte existant (même adresse) reprend son rôle,
 * son nom et le mot de passe, est réactivé et ses sessions tombent.
 * Base distante toujours refusée. N'affiche que les adresses et les rôles.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

type Demo = { role: Role; name: string; emailVar: string; passwordVar: string };

const DEMOS: readonly Demo[] = [
  {
    role: "livreur",
    name: "Livreur Démo",
    emailVar: "AUTH_DEMO_DRIVER_EMAIL",
    passwordVar: "AUTH_DEMO_DRIVER_PASSWORD",
  },
  {
    role: "lecture",
    name: "Lecture Démo",
    emailVar: "AUTH_DEMO_READER_EMAIL",
    passwordVar: "AUTH_DEMO_READER_PASSWORD",
  },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  const problem = remoteDatabaseProblem(
    url,
    "—",
    {},
    "les comptes de démonstration",
  );
  if (problem) throw new Error(problem);

  const ready = DEMOS.filter(
    (demo) => process.env[demo.emailVar] && process.env[demo.passwordVar],
  );
  const missing = DEMOS.filter((demo) => !ready.includes(demo));
  for (const demo of missing) {
    console.warn(
      `[demo] ${demo.name} : ajoutez ${demo.emailVar} et ${demo.passwordVar} dans .env.local.`,
    );
  }
  if (ready.length === 0) {
    process.exitCode = 1;
    return;
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  try {
    for (const demo of ready) {
      const email = process.env[demo.emailVar]!.trim().toLowerCase();
      const password = process.env[demo.passwordVar]!;
      const names = splitFullName(demo.name);
      const refused = passwordProblems(password, {
        email,
        name: demo.name,
      });
      if (refused.length > 0) {
        console.error(
          `[demo] ${demo.name} : mot de passe refusé par la politique (${refused.join(", ")}).`,
        );
        process.exitCode = 1;
        continue;
      }
      const now = new Date();
      const values = {
        ...names,
        role: demo.role,
        passwordHash: await hashPassword(password),
        active: true,
        passwordChangedAt: now,
      };
      const [existing] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(raw`lower(${schema.users.email})`, email))
        .limit(1);
      if (existing) {
        await db
          .update(schema.users)
          .set(values)
          .where(eq(schema.users.id, existing.id));
      } else {
        await db
          .insert(schema.users)
          .values({ id: randomUUID(), email, ...values });
      }
      console.info(
        `[demo] ${demo.name} (${demo.role}) ${existing ? "mis à jour" : "créé"} : ${email} sur ${databaseHost(url)}`,
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("[demo]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
