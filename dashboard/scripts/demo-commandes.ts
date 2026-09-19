import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DbExecutor } from "@/db/client";
import { insertDemoOrder } from "@/db/demo";
import * as schema from "@/db/schema";
import { databaseHost, remoteDatabaseProblem } from "@/lib/database-url";

/*
 * `npm run demo:commandes` : DÉMONSTRATION des alertes en direct. Crée trois
 * commandes, une toutes les dix secondes, dans la base LOCALE, comme si
 * l'application FIG les envoyait : le back-office ouvert dans un navigateur
 * doit sonner et afficher une notification pour chacune.
 * `npm run demo:commandes -- 5 3` : cinq commandes, une toutes les 3 s.
 * - La commande est écrite par src/db/demo.ts (insertDemoOrder), partagé avec
 *   les boutons de simulation du tableau de bord (développement seulement).
 * - Base distante TOUJOURS refusée, sans option pour forcer : ce script
 *   n'écrit que des commandes de démonstration.
 * N'affiche que les références créées, jamais une donnée personnelle.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 60 ? value : fallback;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  const problem = remoteDatabaseProblem(url, "—", {}, "la démonstration");
  if (problem) throw new Error(problem);
  const howMany = positiveInt(process.argv[2], 3);
  const everySeconds = positiveInt(process.argv[3], 10);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema }) as unknown as DbExecutor;
  try {
    console.info(
      `[demo] ${howMany} commande(s), une toutes les ${everySeconds} s, sur ${databaseHost(url)}. Gardez le back-office ouvert (et cliquez une fois dans la page : le navigateur n'autorise le son qu'après un geste).`,
    );
    for (let i = 0; i < howMany; i += 1) {
      await sleep(everySeconds * 1000);
      const reference = await insertDemoOrder(db, new Date(), i);
      console.info(`[demo] ${i + 1}/${howMany} : ${reference}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("[demo]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
