import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";

/*
 * Client Drizzle + postgres.js, PARESSEUX : aucune connexion à l'import, la
 * première au premier appel de getDb(). `next build` importe les pages sans
 * environnement : rien ne doit lire DATABASE_URL avant une vraie requête.
 *
 * server-only en ligne 1 : DATABASE_URL ne doit jamais approcher un bundle client.
 *
 * Options du pool : max 5 (back-office, un processus), idle_timeout 20 s
 * (le dashboard dort la nuit), connect_timeout 10 s (la route santé répond 503 en
 * 10 s au lieu de pendre). `prepare: false` seulement si le client met PgBouncer
 * en mode transaction devant la base (à décider au déploiement).
 *
 * Rechargement à chaud : en développement, chaque modification d'un module amont
 * ré-exécute ce fichier ; sans la mémorisation sur globalThis, un nouveau pool
 * naîtrait à chaque sauvegarde (« too many clients »). Jamais en production.
 */
type Sql = ReturnType<typeof postgres>;
export type Db = ReturnType<typeof drizzle<typeof schema>>;
/** Le client ou une transaction en cours : ce que les sources passent à leurs helpers. */
export type DbExecutor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { figSql?: Sql };
let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const env = getEnv();

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
