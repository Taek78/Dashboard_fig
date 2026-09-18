import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { isUniqueViolation } from "@/db/errors";
import { toCustomer } from "@/db/mappers";
import {
  communities,
  customerLoginCodes,
  customers,
  customerSessions,
} from "@/db/schema";
import {
  loginCodeExpiresAt,
  sessionExpiresAt,
  type CustomerLoginCode,
  type CustomerSession,
} from "@/domain/api/session";
import type {
  ApiAuthSource,
  AuthenticatedCustomer,
  CustomerSignup,
  SignupOutcome,
} from "@/domain/api/source";
import { referralCodeFor } from "@/domain/customers/referral";

/*
 * Implémentation Drizzle du contrat ApiAuthSource (tables customer_login_codes
 * et customer_sessions).
 * - issueLoginCode, en une transaction : purge des codes expirés depuis plus
 *   d'un jour, consommation du code actif de la même adresse (un seul à la
 *   fois), insertion ;
 * - recordLoginCodeAttempt et consumeLoginCode : UPDATE conditionnels, deux
 *   saisies simultanées comptent pour deux, un code ne se consomme qu'une fois ;
 * - signupCustomer, en une transaction : parrain résolu par son code (jamais
 *   un client anonymisé), communauté vérifiée publique et active, code de
 *   parrainage tiré au hasard et réessayé sur collision (index unique), puis
 *   la session ; l'adresse déjà prise est détectée par l'index unique ;
 * - findSession : session et client joints en UNE requête (index unique du
 *   HMAC) ; touchSession n'est appelé qu'au plus toutes les dix minutes.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const REFERRAL_CODE_TRIES = 5;

type CodeRow = typeof customerLoginCodes.$inferSelect;
type SessionRow = typeof customerSessions.$inferSelect;

const toLoginCode = (row: CodeRow): CustomerLoginCode => ({
  id: row.id,
  email: row.email,
  codeHash: row.codeHash,
  attempts: row.attempts,
  expiresAt: row.expiresAt.toISOString(),
  consumedAt: row.consumedAt?.toISOString() ?? null,
  requestedIp: row.requestedIp,
  createdAt: row.createdAt.toISOString(),
});

const toSession = (row: SessionRow): CustomerSession => ({
  id: row.id,
  customerId: row.customerId,
  tokenHash: row.tokenHash,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
});

async function insertSession(
  db: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  customerId: string,
  tokenHash: string,
  now: Date,
): Promise<CustomerSession> {
  const [row] = await db
    .insert(customerSessions)
    .values({
      id: randomUUID(),
      customerId,
      tokenHash,
      createdAt: now,
      expiresAt: sessionExpiresAt(now.getTime()),
      lastSeenAt: now,
    })
    .returning();
  if (!row) throw new Error("Insertion de la session sans ligne renvoyée.");
  return toSession(row);
}

export const apiAuthDb: ApiAuthSource = {
  issueLoginCode: ({ email, codeHash, requestedIp, now }) =>
    getDb().transaction(async (tx) => {
      await tx
        .delete(customerLoginCodes)
        .where(
          lt(customerLoginCodes.expiresAt, new Date(now.getTime() - DAY_MS)),
        );
      await tx
        .update(customerLoginCodes)
        .set({ consumedAt: now })
        .where(
          and(
            eq(customerLoginCodes.email, email),
            isNull(customerLoginCodes.consumedAt),
          ),
        );
      const [row] = await tx
        .insert(customerLoginCodes)
        .values({
          id: randomUUID(),
          email,
          codeHash,
          expiresAt: loginCodeExpiresAt(now.getTime()),
          requestedIp,
          createdAt: now,
        })
        .returning();
      if (!row) throw new Error("Insertion du code sans ligne renvoyée.");
      return toLoginCode(row);
    }),

  findActiveLoginCode: async (email) => {
    const [row] = await getDb()
      .select()
      .from(customerLoginCodes)
      .where(
        and(
          eq(customerLoginCodes.email, email),
          isNull(customerLoginCodes.consumedAt),
        ),
      )
      .orderBy(desc(customerLoginCodes.createdAt))
      .limit(1);
    return row ? toLoginCode(row) : null;
  },

  recordLoginCodeAttempt: async (id) => {
    const [row] = await getDb()
      .update(customerLoginCodes)
      .set({ attempts: sql`${customerLoginCodes.attempts} + 1` })
      .where(eq(customerLoginCodes.id, id))
      .returning({ attempts: customerLoginCodes.attempts });
    return row?.attempts ?? 0;
  },

  consumeLoginCode: async (id, at) => {
    const updated = await getDb()
      .update(customerLoginCodes)
      .set({ consumedAt: at })
      .where(
        and(
          eq(customerLoginCodes.id, id),
          isNull(customerLoginCodes.consumedAt),
        ),
      )
      .returning({ id: customerLoginCodes.id });
    return updated.length > 0;
  },

  openSession: (customerId, tokenHash, now) =>
    getDb().transaction((tx) => insertSession(tx, customerId, tokenHash, now)),

  signupCustomer: (
    signup: CustomerSignup,
    tokenHash,
    now,
  ): Promise<SignupOutcome> =>
    getDb().transaction(async (tx) => {
      let referredById: string | null = null;
      if (signup.referralCode !== null) {
        const [referrer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.referralCode, signup.referralCode),
              isNull(customers.anonymizedAt),
            ),
          )
          .limit(1);
        if (!referrer) return { outcome: "referral_code_unknown" };
        referredById = referrer.id;
      }
      let communityId: string | null = null;
      if (signup.communityId !== null) {
        const [community] = await tx
          .select({ id: communities.id })
          .from(communities)
          .where(
            and(
              eq(communities.id, signup.communityId),
              eq(communities.visibility, "public"),
              eq(communities.active, true),
            ),
          )
          .limit(1);
        if (!community) return { outcome: "community_not_joinable" };
        communityId = community.id;
      }

      const id = randomUUID();
      for (let attempt = 1; ; attempt += 1) {
        try {
          // Point de sauvegarde : un échec d'unicité n'annule pas la transaction.
          await tx.transaction(async (sp) => {
            await sp.insert(customers).values({
              id,
              fullName: signup.fullName,
              email: signup.email,
              phone: signup.phone,
              addressLine: signup.addressLine,
              city: signup.city,
              postalCode: signup.postalCode,
              communityId,
              notifyOffers: signup.consents.offers,
              notifyOrderStatus: signup.consents.orderStatus,
              marketingConsent: signup.consents.marketing,
              consentsUpdatedAt: now,
              referralCode: referralCodeFor(
                signup.fullName,
                randomInt(0, 10_000),
              ),
              referredById,
              createdAt: now,
            });
          });
          break;
        } catch (error) {
          if (isUniqueViolation(error, "customers_email_lower_idx")) {
            return { outcome: "email_taken" };
          }
          if (
            isUniqueViolation(error, "customers_referral_code_idx") &&
            attempt < REFERRAL_CODE_TRIES
          ) {
            continue;
          }
          throw error;
        }
      }

      const session = await insertSession(tx, id, tokenHash, now);
      const [row] = await tx
        .select({
          customer: customers,
          community: { id: communities.id, name: communities.name },
        })
        .from(customers)
        .leftJoin(communities, eq(customers.communityId, communities.id))
        .where(eq(customers.id, id))
        .limit(1);
      if (!row) throw new Error("Client inséré introuvable.");
      const referrer = referredById
        ? ((
            await tx
              .select({ id: customers.id, fullName: customers.fullName })
              .from(customers)
              .where(eq(customers.id, referredById))
              .limit(1)
          )[0] ?? null)
        : null;
      return {
        outcome: "created",
        customer: toCustomer(row.customer, [], row.community, referrer),
        session,
      };
    }),

  findSession: async (tokenHash) => {
    const [row] = await getDb()
      .select({
        session: customerSessions,
        customer: {
          id: customers.id,
          fullName: customers.fullName,
          email: customers.email,
          phone: customers.phone,
          addressLine: customers.addressLine,
          city: customers.city,
          postalCode: customers.postalCode,
          communityId: customers.communityId,
          notifyOrderStatus: customers.notifyOrderStatus,
          anonymizedAt: customers.anonymizedAt,
        },
      })
      .from(customerSessions)
      .innerJoin(customers, eq(customerSessions.customerId, customers.id))
      .where(eq(customerSessions.tokenHash, tokenHash))
      .limit(1);
    if (!row) return null;
    const { anonymizedAt, ...customer } = row.customer;
    const authenticated: AuthenticatedCustomer = {
      ...customer,
      anonymized: anonymizedAt !== null,
    };
    return { session: toSession(row.session), customer: authenticated };
  },

  touchSession: async (id, at) => {
    await getDb()
      .update(customerSessions)
      .set({ lastSeenAt: at })
      .where(eq(customerSessions.id, id));
  },

  revokeSession: async (id, at) => {
    const updated = await getDb()
      .update(customerSessions)
      .set({ revokedAt: at })
      .where(
        and(eq(customerSessions.id, id), isNull(customerSessions.revokedAt)),
      )
      .returning({ id: customerSessions.id });
    return updated.length > 0;
  },

  listCustomerSessions: async (customerId) => {
    const rows = await getDb()
      .select()
      .from(customerSessions)
      .where(eq(customerSessions.customerId, customerId))
      .orderBy(asc(customerSessions.createdAt), asc(customerSessions.id));
    return rows.map(toSession);
  },
};
