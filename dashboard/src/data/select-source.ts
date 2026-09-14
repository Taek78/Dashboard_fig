import "server-only";
import { getEnv } from "@/lib/env";

/*
 * Choix de l'implémentation d'un contrat selon DATA_SOURCE. Chaque façade
 * l'appelle : `selectSource("commandes", ordersMock, ordersDb)`. Le paramètre
 * `db` accepte null pour un domaine qui n'aurait pas encore de version Drizzle :
 * demander "db" lève alors une erreur explicite au lieu de servir des fixtures
 * en silence.
 *
 * Toujours l'appeler au moment de l'usage (`const source = () => selectSource(…)`),
 * jamais au chargement du module : `next build` importe les pages sans
 * environnement, et un appel au chargement y faisait échouer getEnv()
 * (test/app/facades.test.ts).
 */
export function selectSource<T>(domain: string, mock: T, db: T | null): T {
  if (getEnv().DATA_SOURCE === "mock") return mock;
  if (db === null) {
    throw new Error(
      `DATA_SOURCE=db mais l'implémentation Drizzle de « ${domain} » n'existe pas.`,
    );
  }
  return db;
}
