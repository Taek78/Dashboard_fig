import "server-only";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import {
  LONGEST_WINDOW_MS,
  recordFailure,
  type AttemptState,
  type LoginAttemptsSource,
} from "@/lib/rate-limit";

/*
 * Tentatives de connexion dans la table login_attempts (DATA_SOURCE=db) :
 * l'état est partagé par toutes les instances et survit à un redémarrage, un
 * attaquant ne contourne plus le verrou en changeant de serveur.
 *
 * recordFailure est ATOMIQUE, dans une transaction :
 *   1. INSERT … ON CONFLICT DO NOTHING garantit une ligne par clé ;
 *   2. SELECT … FOR UPDATE verrouille ces lignes, dans l'ordre des clés (deux
 *      transactions verrouillent toujours dans le même ordre : pas d'interblocage) ;
 *   3. la règle pure recordFailure() calcule le nouvel état, UPDATE l'écrit.
 * Deux échecs simultanés sur la même clé passent donc l'un après l'autre et
 * comptent pour deux (test/contract/sources.pg.test.ts le vérifie).
 * Purge dans la même transaction : les lignes sans échec récent ni verrou actif
 * sont supprimées, en sautant celles qu'une autre transaction tient (SKIP
 * LOCKED), pour ne jamais attendre ni s'interbloquer.
 * Coût : lecture d'une ligne par clé à chaque connexion, quatre requêtes sur un
 * échec ; rien sur les autres pages.
 */
const toState = (row: typeof loginAttempts.$inferSelect): AttemptState => ({
  failures: row.failures,
  lastFailureAt: row.lastFailureAt.getTime(),
  lockedUntil: row.lockedUntil?.getTime() ?? null,
});

export const loginAttemptsDb: LoginAttemptsSource = {
  async read(keys) {
    if (keys.length === 0) return new Map();
    const rows = await getDb()
      .select()
      .from(loginAttempts)
      .where(inArray(loginAttempts.key, [...keys]));
    return new Map(rows.map((row) => [row.key, toState(row)]));
  },

  recordFailure: (entries, now) =>
    getDb().transaction(async (tx) => {
      if (entries.length === 0) return;
      const keys = entries.map((entry) => entry.key).toSorted();
      await tx
        .insert(loginAttempts)
        .values(
          keys.map((key) => ({
            key,
            failures: 0,
            lastFailureAt: new Date(0),
            lockedUntil: null,
          })),
        )
        .onConflictDoNothing();
      const rows = await tx
        .select()
        .from(loginAttempts)
        .where(inArray(loginAttempts.key, keys))
        .orderBy(loginAttempts.key)
        .for("update");
      const states = new Map(rows.map((row) => [row.key, toState(row)]));

      for (const { key, policy } of entries) {
        const next = recordFailure(states.get(key), now, policy);
        await tx
          .update(loginAttempts)
          .set({
            failures: next.failures,
            lastFailureAt: new Date(next.lastFailureAt),
            lockedUntil:
              next.lockedUntil === null ? null : new Date(next.lockedUntil),
          })
          .where(eq(loginAttempts.key, key));
      }

      const stale = tx
        .select({ key: loginAttempts.key })
        .from(loginAttempts)
        .where(
          and(
            lt(loginAttempts.lastFailureAt, new Date(now - LONGEST_WINDOW_MS)),
            or(
              isNull(loginAttempts.lockedUntil),
              lt(loginAttempts.lockedUntil, new Date(now)),
            ),
          ),
        )
        .for("update", { skipLocked: true });
      await tx.delete(loginAttempts).where(inArray(loginAttempts.key, stale));
    }),

  async clear(keys) {
    if (keys.length === 0) return;
    await getDb()
      .delete(loginAttempts)
      .where(inArray(loginAttempts.key, [...keys]));
  },
};
