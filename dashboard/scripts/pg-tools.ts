import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
 * Localisation et exécution des outils PostgreSQL (pg_dump, pg_restore),
 * partagées par la sauvegarde et la restauration.
 *
 * Portable, et c'est le point : les scripts précédents étaient en PowerShell
 * et cherchaient l'exécutable sous « C:\\Program Files\\PostgreSQL ». Sur le
 * serveur Linux qui hébergera le dashboard, ni l'un ni l'autre n'existe. La
 * recherche va donc du plus explicite au plus devinable :
 *   1. PG_BIN, si l'exploitant désigne un dossier (le cas d'un serveur où
 *      plusieurs versions cohabitent) ;
 *   2. le PATH, qui suffit sur Linux, sur macOS et sur un Windows où le
 *      dossier bin de PostgreSQL a été ajouté ;
 *   3. sous Windows seulement, les dossiers d'installation habituels, la
 *      version la plus récente d'abord.
 *
 * La VERSION compte : pg_restore refuse une sauvegarde produite par un
 * pg_dump plus récent que lui. Le script affiche la version qu'il emploie,
 * pour que l'écart se voie avant l'échec plutôt qu'après.
 */
const WINDOWS_ROOTS = [
  "C:\\Program Files\\PostgreSQL",
  "C:\\Program Files (x86)\\PostgreSQL",
];

export type PgTool = "pg_dump" | "pg_restore";

function windowsCandidates(tool: PgTool): string[] {
  const found: string[] = [];
  for (const root of WINDOWS_ROOTS) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root)
      .filter((name) => /^\d+$/.test(name))
      .sort((a, b) => Number(b) - Number(a));
    for (const version of versions) {
      found.push(join(root, version, "bin", `${tool}.exe`));
    }
  }
  return found;
}

/** Le chemin de l'outil, ou null : à l'appelant de le dire en français. */
export function findPgTool(
  tool: PgTool,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const explicit = env.PG_BIN?.trim();
  if (explicit) {
    for (const name of [`${tool}.exe`, tool]) {
      const candidate = join(explicit, name);
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }
  for (const candidate of windowsCandidates(tool)) {
    if (existsSync(candidate)) return candidate;
  }
  // Ni PG_BIN ni installation Windows connue : le PATH décidera à l'exécution.
  return tool;
}

export function missingToolMessage(tool: PgTool): string {
  return [
    `${tool} introuvable.`,
    "Installez les outils clients PostgreSQL (paquet postgresql-client sur Debian et Ubuntu),",
    "ou désignez leur dossier par la variable PG_BIN.",
  ].join(" ");
}

/** Lance l'outil en laissant sa sortie passer, et rend son code de sortie. */
export function run(command: string, args: readonly string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** La version de l'outil, en une ligne ; null s'il ne répond pas. */
export function toolVersion(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.on("error", () => resolve(null));
    child.on("close", (code) =>
      resolve(code === 0 && out.trim() !== "" ? out.trim() : null),
    );
  });
}
