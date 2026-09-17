import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toAuthToken } from "@/db/mappers";
import { authTokens } from "@/db/schema";
import type { AuthTokensSource, NewAuthToken } from "@/domain/auth/source";
import { AUTH_TOKEN_RULES, type AuthTokenKind } from "@/domain/auth/tokens";

/*
 * Implémentation Drizzle du contrat AuthTokensSource (table auth_tokens).
 * - createToken, dans une transaction : purge des jetons expirés depuis plus
 *   d'un jour (aucune tâche planifiée à prévoir), consommation des jetons
 *   actifs de même sorte pour ce compte quand la sorte est exclusive (un seul
 *   code, une seule invitation), puis insertion ;
 * - recordTokenAttempt et consumeToken sont des UPDATE conditionnels : deux
 *   saisies simultanées du même code comptent pour deux essais, et un jeton ne
 *   se consomme qu'une fois, même si deux requêtes arrivent ensemble.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const authTokensDb: AuthTokensSource = {
  createToken: (input: NewAuthToken) =>
    getDb().transaction(async (tx) => {
      const now = new Date();
      await tx
        .delete(authTokens)
        .where(lt(authTokens.expiresAt, new Date(now.getTime() - DAY_MS)));
      if (AUTH_TOKEN_RULES[input.kind].exclusive) {
        await tx
          .update(authTokens)
          .set({ consumedAt: now })
          .where(
            and(
              eq(authTokens.userId, input.userId),
              eq(authTokens.kind, input.kind),
              isNull(authTokens.consumedAt),
            ),
          );
      }
      const [row] = await tx
        .insert(authTokens)
        .values({
          id: randomUUID(),
          kind: input.kind,
          userId: input.userId,
          secretHash: input.secretHash,
          expiresAt: input.expiresAt,
          requestedIp: input.requestedIp,
          createdAt: now,
        })
        .returning();
      if (!row) throw new Error("Insertion du jeton sans ligne renvoyée.");
      return toAuthToken(row);
    }),

  findActiveToken: async (kind: AuthTokenKind, userId: string) => {
    const [row] = await getDb()
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.kind, kind),
          isNull(authTokens.consumedAt),
        ),
      )
      .orderBy(desc(authTokens.createdAt))
      .limit(1);
    return row ? toAuthToken(row) : null;
  },

  findTokenByHash: async (kind: AuthTokenKind, secretHash: string) => {
    const [row] = await getDb()
      .select()
      .from(authTokens)
      .where(
        and(eq(authTokens.kind, kind), eq(authTokens.secretHash, secretHash)),
      )
      .limit(1);
    return row ? toAuthToken(row) : null;
  },

  recordTokenAttempt: async (id: string) => {
    const [row] = await getDb()
      .update(authTokens)
      .set({ attempts: sql`${authTokens.attempts} + 1` })
      .where(eq(authTokens.id, id))
      .returning({ attempts: authTokens.attempts });
    return row?.attempts ?? 0;
  },

  consumeToken: async (id: string, at: Date) => {
    const updated = await getDb()
      .update(authTokens)
      .set({ consumedAt: at })
      .where(and(eq(authTokens.id, id), isNull(authTokens.consumedAt)))
      .returning({ id: authTokens.id });
    return updated.length > 0;
  },
};
