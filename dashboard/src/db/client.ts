import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";

/*
 * Client Drizzle + postgres.js, PARESSEUX : aucune connexion à l'import, la
 * première au premier appel de getDb(), et seulement si DATA_SOURCE vaut "db".
 * En mode mock, l'appeler est une erreur de programmation (message explicite).
 *
 * server-only en ligne 1 : DATABASE_URL ne doit jamais approcher un bundle client.
 *
 * Options du pool (spec B1) : max 5 (back-office, un processus), idle_timeout 20 s
 * (le dashboard dort la nuit), connect_timeout 10 s (la route santé répond 503 en
 * 10 s au lieu de pendre). `prepare: false` seulement si le client met PgBouncer
 * en mode transaction devant sa base (question B2).
 *
 * Rechargement à chaud : en développement, chaque modification d'un module amont
 * ré-exécute ce fichier ; sans la mémorisation sur globalThis, un nouveau pool
 * naîtrait à chaque sauvegarde (« too many clients »). Jamais en production.
 */
type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { figSql?: Sql };
let db: Db | null = null;

export function getDb(): Db {
  const env = getEnv();
  if (env.DATA_SOURCE !== "db") {
    throw new Error(
      "getDb() appelé alors que DATA_SOURCE n'est pas \"db\" : la base n'est pas branchée.",
    );
  }
  if (db) return db;

  const sql =
    globalForDb.figSql ??
    postgres(env.DATABASE_URL, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  if (process.env.NODE_ENV !== "production") globalForDb.figSql = sql;

  db = drizzle(sql, { schema });
  return db;
}
