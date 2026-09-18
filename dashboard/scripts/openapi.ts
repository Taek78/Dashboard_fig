import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildOpenApiDocument } from "@/domain/api/openapi";

/*
 * `npm run api:openapi` : écrit la description OpenAPI de l'API dans
 * docs/api/openapi.json (à commiter). test/domain/api/openapi.test.ts échoue
 * quand le fichier commité ne correspond plus au code : lancer ce script.
 * Hors Next : aucun module server-only, aucune base.
 */
export const OPENAPI_FILE = path.resolve(
  process.cwd(),
  "..",
  "docs",
  "api",
  "openapi.json",
);

export function renderOpenApi(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}

async function main(): Promise<void> {
  await mkdir(path.dirname(OPENAPI_FILE), { recursive: true });
  await writeFile(OPENAPI_FILE, renderOpenApi(), "utf8");
  console.info(`[openapi] écrit : ${OPENAPI_FILE}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  main().catch((error: unknown) => {
    console.error("[openapi] échec :", error);
    process.exitCode = 1;
  });
}
