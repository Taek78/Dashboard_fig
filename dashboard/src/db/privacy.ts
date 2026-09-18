import { randomUUID } from "node:crypto";
import {
  and,
  count,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type { DbExecutor } from "@/db/client";
import {
  apiIdempotencyKeys,
  customerLoginCodes,
  customerMessages,
  customerNotes,
  customerNotifications,
  customers,
  customerSessions,
  loginAttempts,
  messageUploads,
  orderEvents,
  orders,
  securityEvents,
} from "@/db/schema";
import {
  anonymizedCustomerFields,
  type AnonymizeOutcome,
} from "@/domain/privacy/anonymization";
import { retentionCutoffs, type Retention } from "@/domain/privacy/retention";

/*
 * Écritures RGPD en SQL, partagées par la Server Action d'anonymisation (via
 * src/data/privacy.db.ts) et par le script `npm run rgpd:purge`. Pas de
 * server-only : le script tourne hors de Next (le type DbExecutor est effacé
 * à la compilation). Chaque fonction reçoit la base ou la transaction.
 */

/**
 * Types du journal qui prouvent qu'une demande RGPD a été traitée : jamais
 * purgés avec le reste du journal, leur durée reste à fixer (question 18).
 */
export const PRIVACY_PROOF_EVENT_TYPES = [
  "customer_exported",
  "customer_anonymized",
] as const;

/** Acteur inscrit au journal pour les anonymisations faites par la purge. */
export const PURGE_ACTOR = "rgpd-purge";

/** Commande qui a encore besoin des coordonnées du client (statuts constants, jamais une saisie). */
const hasOpenOrder = sql`exists (
  select 1 from ${orders}
  where ${orders.customerId} = ${customers.id}
    and ${orders.status} in ('preparing', 'delivering')
)`;

/**
 * Supprime les notes, les messages « Nous contacter » et les notifications
 * déposées d'un client, et efface de ses commandes la rue de livraison et les
 * précisions libres des annulations. Un message est du texte écrit par la
 * personne, souvent nominatif (« mon code d'entrée est… ») : le garder
 * viderait l'anonymisation de son sens. Ses pièces jointes partent avec lui
 * (ON DELETE CASCADE), et les FICHIERS qu'elle a téléversés (photos, PDF,
 * hébergés ici depuis le 2026-09-18) sont supprimés avec leurs octets, joints
 * ou non à un message. La rue identifie un foyer :
 * seuls ville et code postal restent sur les commandes.
 * API (2026-09-17) : les sessions de l'application sont supprimées (la
 * personne ne peut plus se connecter à un compte effacé) avec les réponses
 * mémorisées des clés d'idempotence (elles contiennent ses données) ; les codes
 * de connexion de son adresse sont effacés AVANT que l'adresse soit remplacée
 * (anonymizeCustomerRows).
 */
async function eraseFreeText(tx: DbExecutor, customerId: string) {
  await tx
    .delete(customerSessions)
    .where(eq(customerSessions.customerId, customerId));
  await tx
    .delete(apiIdempotencyKeys)
    .where(eq(apiIdempotencyKeys.customerId, customerId));
  await tx
    .delete(customerNotes)
    .where(eq(customerNotes.customerId, customerId));
  await tx
    .delete(customerMessages)
    .where(eq(customerMessages.customerId, customerId));
  await tx
    .delete(messageUploads)
    .where(eq(messageUploads.customerId, customerId));
  await tx
    .delete(customerNotifications)
    .where(eq(customerNotifications.customerId, customerId));
  await tx
    .update(orders)
    .set({ cancellationDetail: null, deliveryAddressLine: null })
    .where(eq(orders.customerId, customerId));
  await tx
    .update(orderEvents)
    .set({ cancellationDetail: null })
    .where(
      inArray(
        orderEvents.orderId,
        tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.customerId, customerId)),
      ),
    );
}

/**
 * Anonymise un client en une transaction (voir domain/privacy/anonymization.ts).
 * Conditionnelle : la ligne n'est réécrite que si elle n'est pas déjà
 * anonymisée ET qu'aucune commande n'est en préparation ou expédiée. Une
 * annulation concurrente pas encore validée laisse voir « en préparation » :
 * l'anonymisation refuse, aucun texte libre ne peut s'écrire après elle.
 * Sur un client déjà anonymisé, le nettoyage des textes libres est rejoué :
 * rejouer la demande répare un reste laissé par une course.
 */
export async function anonymizeCustomerRows(
  db: DbExecutor,
  customerId: string,
  at: Date,
): Promise<AnonymizeOutcome> {
  return db.transaction(async (tx) => {
    // Codes de connexion de l'application rangés par adresse : effacés tant
    // que l'adresse est encore connue (elle est remplacée juste après).
    await tx.delete(customerLoginCodes).where(
      sql`${customerLoginCodes.email} = (
        select lower(${customers.email}) from ${customers}
        where ${customers.id} = ${customerId}
      )`,
    );
    const [done] = await tx
      .update(customers)
      .set({
        ...anonymizedCustomerFields(customerId),
        communityId: null,
        anonymizedAt: at,
      })
      .where(
        and(
          eq(customers.id, customerId),
          isNull(customers.anonymizedAt),
          sql`not ${hasOpenOrder}`,
        ),
      )
      .returning({ id: customers.id });
    if (done) {
      await eraseFreeText(tx, customerId);
      return "anonymized";
    }
    const [row] = await tx
      .select({ anonymizedAt: customers.anonymizedAt })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!row) return "not_found";
    if (row.anonymizedAt === null) return "open_orders";
    await eraseFreeText(tx, customerId);
    return "already_anonymized";
  });
}

/**
 * Clients encore identifiés sans activité depuis `since` ("AAAA-MM-JJ") : même
 * règle que isCustomerInactive (création en UTC, aucun jour de livraison à
 * partir de `since`, aucune commande ouverte). Triés par identifiant.
 */
export async function findInactiveCustomers(
  db: DbExecutor,
  since: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      sql`${customers.anonymizedAt} is null
        and (${customers.createdAt} at time zone 'UTC')::date < ${since}::date
        and not exists (
          select 1 from ${orders}
          where ${orders.customerId} = ${customers.id}
            and ${orders.deliveryDate} >= ${since}::date
        )
        and not ${hasOpenOrder}`,
    )
    .orderBy(customers.id);
  return rows.map((r) => r.id);
}

export type PurgeReport = {
  cutoffs: ReturnType<typeof retentionCutoffs>;
  /** Lignes du journal de sécurité hors durée, preuves RGPD exclues (supprimées si apply). */
  securityEvents: number;
  /** Tentatives de connexion expirées sans verrou actif (supprimées si apply). */
  loginAttempts: number;
  /** API de l'application : codes de connexion, sessions et clés d'idempotence hors durée (supprimés si apply). */
  customerLoginCodes: number;
  customerSessions: number;
  idempotencyKeys: number;
  /** Fichiers téléversés jamais joints à un message, hors durée (supprimés si apply). */
  unattachedUploads: number;
  /** Clients inactifs (anonymisés si apply). */
  inactiveCustomers: string[];
  /** Clients inactifs non anonymisés par --apply (une commande ouverte entre-temps). */
  skippedCustomers: string[];
};

/**
 * Applique les durées de conservation à l'instant `now`. Sans `apply`, ne fait
 * que compter : c'est l'aperçu montré avant toute écriture. Avec `apply`,
 * chaque anonymisation est journalisée (acteur PURGE_ACTOR) et `onProgress`
 * reçoit l'avancement : un arrêt en cours de route se relance sans risque,
 * tout est conditionnel.
 */
export async function purgeExpiredData(
  db: DbExecutor,
  now: Date,
  {
    apply,
    retention,
    onProgress,
  }: {
    apply: boolean;
    retention?: Retention;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<PurgeReport> {
  const cutoffs = retentionCutoffs(now, retention);
  const oldEvents = and(
    lt(securityEvents.at, cutoffs.securityEventsBefore),
    notInArray(securityEvents.type, [...PRIVACY_PROOF_EVENT_TYPES]),
  );
  const staleAttempts = and(
    lt(loginAttempts.lastFailureAt, cutoffs.loginAttemptsBefore),
    or(isNull(loginAttempts.lockedUntil), lt(loginAttempts.lockedUntil, now)),
  );
  const staleCodes = lt(
    customerLoginCodes.expiresAt,
    cutoffs.customerLoginCodesBefore,
  );
  // Expirée depuis trente jours, ou révoquée depuis trente jours.
  const staleSessions = or(
    lt(customerSessions.expiresAt, cutoffs.customerSessionsBefore),
    lt(customerSessions.revokedAt, cutoffs.customerSessionsBefore),
  );
  const staleKeys = lt(
    apiIdempotencyKeys.expiresAt,
    cutoffs.idempotencyKeysBefore,
  );
  const staleUploads = and(
    isNull(messageUploads.attachedAt),
    lt(messageUploads.createdAt, cutoffs.unattachedUploadsBefore),
  );
  const inactiveCustomers = await findInactiveCustomers(
    db,
    cutoffs.customerActivitySince,
  );

  if (!apply) {
    const [[events], [attempts], [codes], [sessions], [keys], [uploads]] =
      await Promise.all([
        db.select({ n: count() }).from(securityEvents).where(oldEvents),
        db.select({ n: count() }).from(loginAttempts).where(staleAttempts),
        db.select({ n: count() }).from(customerLoginCodes).where(staleCodes),
        db.select({ n: count() }).from(customerSessions).where(staleSessions),
        db.select({ n: count() }).from(apiIdempotencyKeys).where(staleKeys),
        db.select({ n: count() }).from(messageUploads).where(staleUploads),
      ]);
    return {
      cutoffs,
      securityEvents: events?.n ?? 0,
      loginAttempts: attempts?.n ?? 0,
      customerLoginCodes: codes?.n ?? 0,
      customerSessions: sessions?.n ?? 0,
      idempotencyKeys: keys?.n ?? 0,
      unattachedUploads: uploads?.n ?? 0,
      inactiveCustomers,
      skippedCustomers: [],
    };
  }

  const deletedEvents = await db
    .delete(securityEvents)
    .where(oldEvents)
    .returning({ id: securityEvents.id });
  const deletedAttempts = await db
    .delete(loginAttempts)
    .where(staleAttempts)
    .returning({ key: loginAttempts.key });
  const deletedCodes = await db
    .delete(customerLoginCodes)
    .where(staleCodes)
    .returning({ id: customerLoginCodes.id });
  const deletedSessions = await db
    .delete(customerSessions)
    .where(staleSessions)
    .returning({ id: customerSessions.id });
  const deletedKeys = await db
    .delete(apiIdempotencyKeys)
    .where(staleKeys)
    .returning({ key: apiIdempotencyKeys.key });
  const deletedUploads = await db
    .delete(messageUploads)
    .where(staleUploads)
    .returning({ id: messageUploads.id });
  const skippedCustomers: string[] = [];
  for (const [index, id] of inactiveCustomers.entries()) {
    const outcome = await anonymizeCustomerRows(db, id, now);
    if (outcome === "anonymized") {
      await db.insert(securityEvents).values({
        id: randomUUID(),
        type: "customer_anonymized",
        details: { userId: PURGE_ACTOR, customerId: id },
        at: now,
      });
    } else if (outcome === "open_orders") {
      skippedCustomers.push(id);
    }
    onProgress?.(index + 1, inactiveCustomers.length);
  }
  return {
    cutoffs,
    securityEvents: deletedEvents.length,
    loginAttempts: deletedAttempts.length,
    customerLoginCodes: deletedCodes.length,
    customerSessions: deletedSessions.length,
    idempotencyKeys: deletedKeys.length,
    unattachedUploads: deletedUploads.length,
    inactiveCustomers,
    skippedCustomers,
  };
}
