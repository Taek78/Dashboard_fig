import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { findPgTool, missingToolMessage, run, toolVersion } from "./pg-tools";
import { databaseHost } from "@/lib/database-url";

/*
 * `npm run db:backup` : sauvegarde la base de DATABASE_URL au format custom de
 * pg_dump (compressé, restaurable table par table par scripts/restore.ts).
 *
 * PORTABLE (2026-09-18) : remplace backup.ps1, qui exigeait PowerShell et une
 * installation de PostgreSQL sous « C:\\Program Files ». Le serveur de
 * production sera sous Linux ; une sauvegarde qui ne s'y lance pas ne vaut
 * rien.
 *
 * Le fichier va dans FIG_BACKUP_DIR, sinon dans un dossier hors du dépôt et
 * hors OneDrive (%LOCALAPPDATA%\fig-backups sous Windows, ~/fig-backups
 * ailleurs) : une sauvegarde contient toutes les données personnelles des
 * clients, elle n'a rien à faire dans un dossier synchronisé ni versionné.
 *
 * Lire une sauvegarde ne modifie rien : aucune garde d'hôte ici, contrairement
 * à la restauration. L'hôte est affiché, pour qu'on sache ce qu'on emporte.
 * Hors Next : lit .env.local lui-même.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function backupDir(): string {
  const chosen = process.env.FIG_BACKUP_DIR?.trim();
  if (chosen) return chosen;
  const local = process.env.LOCALAPPDATA;
  return local ? join(local, "fig-backups") : join(homedir(), "fig-backups");
}

/** `fig-20260918-1432.dump` : triable, lisible, sans caractère à échapper. */
function fileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `fig-${stamp}.dump`;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");

  const tool = findPgTool("pg_dump");
  if (tool === null) throw new Error(missingToolMessage("pg_dump"));
  const version = await toolVersion(tool);
  if (version === null) throw new Error(missingToolMessage("pg_dump"));

  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, fileName(new Date()));

  console.info(`Base   : ${databaseHost(url)}`);
  console.info(`Outil  : ${version}`);
  console.info(`Fichier: ${file}`);

  const code = await run(tool, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    file,
    url,
  ]);
  if (code !== 0) throw new Error(`pg_dump a échoué (code ${code}).`);

  const size = (statSync(file).size / 1024).toFixed(1);
  console.info(`Sauvegarde écrite : ${file} (${size} Ko)`);
  console.info(
    "Une sauvegarde jamais restaurée n'est pas une sauvegarde : répétez la restauration (npm run db:restore).",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
