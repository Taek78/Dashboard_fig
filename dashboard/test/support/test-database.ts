import { afterAll, afterEach, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { TEST_DATABASE_URL } from "./config";

/*
 * Accès à la base de TEST pour les tests de la couche données et des Server
 * Actions (projet « db » de Vitest). Un fichier de test l'utilise ainsi :
 *
 *   vi.mock("server-only", () => ({}));
 *   vi.mock("@/db/client", () => import("../support/test-database").then((m) => m.dbClientMock));
 *   const { isolateEachTest } = await import("../support/test-database");
 *   isolateEachTest();
 *
 * isolateEachTest() ouvre une transaction avant chaque test et l'ANNULE après :
 * getDb() renvoie cette transaction, le code testé écrit dedans (ses propres
 * transactions deviennent des savepoints), rien ne reste en base. Chaque test
 * repart donc des données seedées par global-setup.ts, sans re-seed.
 * Sans isolateEachTest(), getDb() renvoie le pool : utile pour tester de vraies
 * écritures concurrentes (plusieurs connexions), à nettoyer soi-même.
 */
const sql = postgres(TEST_DATABASE_URL, { max: 10, onnotice: () => {} });
export const rootDb = drizzle(sql, { schema }) as unknown as Db;

let current: Db | null = null;

/** La transaction du test en cours, sinon le pool. */
export function testDb(): Db {
  return current ?? rootDb;
}

/** Remplaçant de @/db/client pour vi.mock. */
export const dbClientMock = { getDb: () => testDb() };

class Rollback extends Error {}

export function isolateEachTest(): void {
  let release: () => void = () => {};
  let finished: Promise<void> = Promise.resolve();

  beforeEach(
    () =>
      new Promise<void>((ready, fail) => {
        finished = rootDb
          .transaction(async (tx) => {
            current = tx as unknown as Db;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          })
          .catch((error: unknown) => {
            if (!(error instanceof Rollback)) fail(error);
          });
      }),
  );

  afterEach(async () => {
    release();
    await finished;
    current = null;
  });

  closeAfterAll();
}

/** Ferme le pool à la fin du fichier (appelé par isolateEachTest). */
export function closeAfterAll(): void {
  afterAll(() => sql.end());
}
