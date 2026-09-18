import { existsSync } from "node:fs";
import { findPgTool, missingToolMessage, run, toolVersion } from "./pg-tools";
import { databaseHost, remoteDatabaseProblem } from "@/lib/database-url";

/*
 * `npm run db:restore -- <fichier.dump>` : restaure dans la base de
 * DATABASE_URL une sauvegarde faite par scripts/backup.ts.
 *
 * PORTABLE (2026-09-18) : remplace restore.ps1 (PowerShell et chemins
 * Windows). C'est le script qui compte le plus le jour d'un incident, donc
 * celui qui doit fonctionner sur le serveur, pas seulement sur le poste qui
 * l'a écrit.
 *
 * DESTRUCTEUR : `--clean --if-exists` supprime les objets existants avant de
 * les recréer. La garde d'hôte partagée (src/lib/database-url.ts, la même que
 * le seed et la purge RGPD) refuse une base qui n'est pas locale sans
 * SEED_ALLOW_REMOTE=1. Attention : « localhost » peut être un tunnel vers la
 * production ; l'hôte est affiché avant d'écrire, à lire.
 * Hors Next : lit .env.local lui-même.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

async function main(): Promise<void> {
  const dump = process.argv[2];
  if (!dump) {
    throw new Error(
      "Fichier manquant. Usage : npm run db:restore -- <chemin du .dump>",
    );
  }
  if (!existsSync(dump)) throw new Error(`Fichier introuvable : ${dump}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  const problem = remoteDatabaseProblem(
    url,
    "SEED_ALLOW_REMOTE",
    process.env,
    "la restauration",
  );
  if (problem !== null) throw new Error(problem);

  const tool = findPgTool("pg_restore");
  if (tool === null) throw new Error(missingToolMessage("pg_restore"));
  const version = await toolVersion(tool);
  if (version === null) throw new Error(missingToolMessage("pg_restore"));

  console.info(`Base   : ${databaseHost(url)} (le contenu sera REMPLACÉ)`);
  console.info(`Outil  : ${version}`);
  console.info(`Fichier: ${dump}`);

  const code = await run(tool, [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    url,
    dump,
  ]);
  if (code !== 0) {
    /*
     * Constaté en répétition le 2026-09-18 : un pg_restore plus récent que le
     * serveur émet des paramètres que celui-ci ignore (« unrecognized
     * configuration parameter "transaction_timeout" » d'un client 18 vers un
     * serveur 16), et rend 1 alors que presque tout est restauré. Le message
     * brut n'aide personne à trois heures du matin : il est traduit ici.
     */
    throw new Error(
      [
        `pg_restore a échoué (code ${code}).`,
        "Si le message ci-dessus parle d'un paramètre de configuration inconnu,",
        "les outils clients sont plus récents que le serveur : restaurez avec des",
        "outils de la MÊME version majeure que lui (variable PG_BIN), ou mettez le",
        "serveur à niveau. Une restauration partielle laisse une base incomplète :",
        "recommencez sur une base vide avant de la remettre en service.",
      ].join(" "),
    );
  }
  console.info(`Restauration terminée depuis ${dump}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
