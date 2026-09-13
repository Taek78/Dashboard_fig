import "server-only";
import { getEnv } from "@/lib/env";

/*
 * Choix de l'implémentation d'un contrat selon DATA_SOURCE (B1). Chaque façade
 * l'appelle : `selectSource("commandes", ordersMock, ordersDb)`. Tant qu'une
 * version Drizzle n'existe pas (B3), on passe null : demander "db" lève alors une
 * erreur explicite au lieu de servir des fixtures en silence.
 */
export function selectSource<T>(domain: string, mock: T, db: T | null): T {
  if (getEnv().DATA_SOURCE === "mock") return mock;
  if (db === null) {
    throw new Error(
      `DATA_SOURCE=db mais l'implémentation Drizzle de « ${domain} » n'existe pas encore (piste B3).`,
    );
  }
  return db;
}
