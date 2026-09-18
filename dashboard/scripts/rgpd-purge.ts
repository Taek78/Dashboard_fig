import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DbExecutor } from "@/db/client";
import { purgeExpiredData } from "@/db/privacy";
import * as schema from "@/db/schema";
import { RETENTION } from "@/domain/privacy/retention";
import { databaseHost, remoteDatabaseProblem } from "@/lib/database-url";

/*
 * `npm run rgpd:purge` : applique les durées de conservation RGPD
 * (src/domain/privacy/retention.ts) à la base de DATABASE_URL.
 * - Par défaut, APERÇU seulement : ce qui serait supprimé ou anonymisé.
 * - `npm run rgpd:purge -- --apply` : écrit (suppressions du journal de
 *   sécurité hors preuves RGPD et des tentatives de connexion, anonymisation
 *   journalisée des clients inactifs), irréversible.
 * Une base qui n'est pas locale est refusée sans RGPD_ALLOW_REMOTE=1 : viser
 * la production doit être une décision explicite. Attention : « localhost »
 * peut être un tunnel vers la production, lire l'hôte affiché avant --apply.
 * Ne pas planifier --apply avant les réponses du client aux questions 14, 18
 * et 19 : le dashboard ne voit pas l'activité d'un client dans l'application.
 * N'affiche que des nombres et des identifiants techniques, jamais une donnée
 * personnelle. Hors Next : lit .env.local lui-même.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const SHOWN_IDS = 20;
const PROGRESS_EVERY = 25;

const list = (ids: readonly string[]) =>
  ids.length > 0
    ? ` (${ids.slice(0, SHOWN_IDS).join(", ")}${ids.length > SHOWN_IDS ? ", …" : ""})`
    : "";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  // Règle partagée avec le seed et la restauration (src/lib/database-url.ts).
  const problem = remoteDatabaseProblem(
    url,
    "RGPD_ALLOW_REMOTE",
    process.env,
    "la purge",
  );
  if (problem) throw new Error(problem);
  const host = databaseHost(url);
  const apply = process.argv.includes("--apply");
  console.info(
    `[rgpd] ${apply ? "APPLICATION" : "APERÇU (rien n'est écrit ; --apply pour appliquer)"} sur ${host}`,
  );

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const report = await purgeExpiredData(
      drizzle(sql, { schema }) as unknown as DbExecutor,
      new Date(),
      {
        apply,
        onProgress: (done, total) => {
          if (done % PROGRESS_EVERY === 0 || done === total) {
            console.info(`[rgpd] anonymisation : ${done}/${total}`);
          }
        },
      },
    );
    const ids = report.inactiveCustomers;
    console.info(
      [
        `[rgpd] durées : clients inactifs ${RETENTION.inactiveCustomerYears} ans, journal de sécurité ${RETENTION.securityEventMonths} mois (preuves RGPD conservées), tentatives de connexion ${RETENTION.loginAttemptHours} h`,
        `[rgpd] journal de sécurité antérieur au ${report.cutoffs.securityEventsBefore.toISOString()} : ${report.securityEvents} ligne(s) ${apply ? "supprimée(s)" : "à supprimer"}`,
        `[rgpd] tentatives de connexion expirées : ${report.loginAttempts} ${apply ? "supprimée(s)" : "à supprimer"}`,
        `[rgpd] API de l'application : codes de connexion ${report.customerLoginCodes}, sessions ${report.customerSessions}, clés d'idempotence ${report.idempotencyKeys} ${apply ? "supprimé(e)s" : "à supprimer"}`,
        `[rgpd] clients sans activité depuis le ${report.cutoffs.customerActivitySince} : ${ids.length} ${apply ? "traité(s)" : "à anonymiser"}${list(ids)}`,
        ...(report.skippedCustomers.length > 0
          ? [
              `[rgpd] non anonymisés (commande ouverte entre-temps) : ${report.skippedCustomers.length}${list(report.skippedCustomers)}`,
            ]
          : []),
      ].join("\n"),
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    "[rgpd] échec :",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
