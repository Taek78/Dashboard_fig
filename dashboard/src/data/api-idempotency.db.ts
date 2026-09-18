import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiIdempotencyKeys } from "@/db/schema";
import type { IdempotencyClaim, IdempotencySource } from "@/domain/api/source";

/*
 * Implémentation Drizzle du contrat IdempotencySource (table
 * api_idempotency_keys). claim() est ATOMIQUE : INSERT … ON CONFLICT DO
 * NOTHING prend la clé ; zéro ligne insérée = la clé existe déjà, et la ligne
 * relue dit si le traitement est encore en cours (réponse NULL), si le corps
 * diffère (hash) ou quelle réponse rejouer. Les clés expirées sont purgées à
 * chaque prise (index sur expires_at) : rien à planifier.
 */
export const apiIdempotencyDb: IdempotencySource = {
  claim: ({ customerId, key, requestHash, now, ttlMs }) =>
    getDb().transaction(async (tx): Promise<IdempotencyClaim> => {
      await tx
        .delete(apiIdempotencyKeys)
        .where(lt(apiIdempotencyKeys.expiresAt, now));
      const inserted = await tx
        .insert(apiIdempotencyKeys)
        .values({
          customerId,
          key,
          requestHash,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
        })
        .onConflictDoNothing()
        .returning({ key: apiIdempotencyKeys.key });
      if (inserted.length > 0) return { state: "claimed" };
      const [row] = await tx
        .select()
        .from(apiIdempotencyKeys)
        .where(
          and(
            eq(apiIdempotencyKeys.customerId, customerId),
            eq(apiIdempotencyKeys.key, key),
          ),
        )
        .limit(1);
      // Supprimée entre-temps (expirée) : l'appelant relance simplement.
      if (!row) return { state: "claimed" };
      if (row.requestHash !== requestHash) return { state: "mismatch" };
      if (row.responseStatus === null) return { state: "in_progress" };
      return {
        state: "replay",
        status: row.responseStatus,
        body: row.responseBody,
      };
    }),

  complete: async ({ customerId, key, status, body }) => {
    await getDb()
      .update(apiIdempotencyKeys)
      .set({ responseStatus: status, responseBody: body })
      .where(
        and(
          eq(apiIdempotencyKeys.customerId, customerId),
          eq(apiIdempotencyKeys.key, key),
        ),
      );
  },

  release: async (customerId, key) => {
    await getDb()
      .delete(apiIdempotencyKeys)
      .where(
        and(
          eq(apiIdempotencyKeys.customerId, customerId),
          eq(apiIdempotencyKeys.key, key),
        ),
      );
  },
};
