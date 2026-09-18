import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { toCustomer, toCustomerNote, toCustomerReferral } from "@/db/mappers";
import { communities, customerNotes, customers } from "@/db/schema";
import { filterCustomers, sortCustomersByName } from "@/domain/customers/rules";
import type { CustomersSource } from "@/domain/customers/source";
import type {
  Customer,
  CustomerFilters,
  CustomerNote,
  CustomerProfilePatch,
} from "@/domain/customers/types";

/*
 * Implémentation Drizzle du contrat CustomersSource. La recherche (nom,
 * e-mail, chiffres du téléphone, sans accents) reste la règle pure du domaine,
 * appliquée après chargement. Le parrain est joint sur la table elle-même
 * (alias « referrer ») ; les filleuls se lisent à part, pour la fiche seule.
 * À passer en SQL (pg_trgm) si la table dépasse quelques milliers de clients.
 */
const referrer = alias(customers, "referrer");

async function loadCustomers(
  ids?: readonly string[],
  email?: string,
): Promise<Customer[]> {
  const db = getDb();
  const base = db
    .select({
      customer: customers,
      community: { id: communities.id, name: communities.name },
      referrer: { id: referrer.id, fullName: referrer.fullName },
    })
    .from(customers)
    .leftJoin(communities, eq(customers.communityId, communities.id))
    .leftJoin(referrer, eq(customers.referredById, referrer.id));
  const rows =
    email !== undefined
      ? await base.where(
          sql`lower(${customers.email}) = ${email.toLowerCase()}`,
        )
      : ids === undefined
        ? await base
        : await base.where(inArray(customers.id, ids));
  if (rows.length === 0) return [];
  const notes = await db
    .select()
    .from(customerNotes)
    .where(
      inArray(
        customerNotes.customerId,
        rows.map((r) => r.customer.id),
      ),
    )
    .orderBy(asc(customerNotes.createdAt));
  const byCustomer = new Map<string, typeof notes>();
  for (const note of notes) {
    const list = byCustomer.get(note.customerId) ?? [];
    list.push(note);
    byCustomer.set(note.customerId, list);
  }
  return rows.map((r) =>
    toCustomer(
      r.customer,
      byCustomer.get(r.customer.id) ?? [],
      r.community,
      r.referrer,
    ),
  );
}

export const customersDb: CustomersSource = {
  getCustomers: async (filters: CustomerFilters = {}) =>
    sortCustomersByName(filterCustomers(await loadCustomers(), filters)),

  getCustomer: async (id: string) => {
    const [customer] = await loadCustomers([id]);
    return customer ?? null;
  },

  // Index unique customers_email_lower_idx : une adresse, un client.
  findCustomerByEmail: async (email: string) => {
    const [customer] = await loadCustomers(undefined, email);
    return customer ?? null;
  },

  // Écriture conditionnelle : jamais sur un client anonymisé (ses données
  // effacées ne doivent pas revenir). Les autorisations sont datées ici,
  // horloge de l'application : preuve du consentement.
  updateCustomerProfile: async (
    id: string,
    patch: CustomerProfilePatch,
    now: Date,
  ) => {
    const set = {
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.addressLine !== undefined
        ? { addressLine: patch.addressLine }
        : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.postalCode !== undefined
        ? { postalCode: patch.postalCode }
        : {}),
      ...(patch.consents !== undefined
        ? {
            notifyOffers: patch.consents.offers,
            notifyOrderStatus: patch.consents.orderStatus,
            marketingConsent: patch.consents.marketing,
            consentsUpdatedAt: now,
          }
        : {}),
    };
    if (Object.keys(set).length === 0) return customersDb.getCustomer(id);
    const updated = await getDb()
      .update(customers)
      .set(set)
      .where(and(eq(customers.id, id), isNull(customers.anonymizedAt)))
      .returning({ id: customers.id });
    return updated.length === 0 ? null : customersDb.getCustomer(id);
  },

  // Adhésion (communauté publique et active, vérifiée par la base dans la
  // même instruction) ou départ (null) ; jamais pour un client anonymisé.
  setCustomerCommunity: async (id: string, communityId: string | null) => {
    const db = getDb();
    const joinable =
      communityId === null
        ? sql`true`
        : sql`exists (select 1 from ${communities} c where c.id = ${communityId} and c.visibility = 'public' and c.active)`;
    const updated = await db
      .update(customers)
      .set({ communityId })
      .where(
        and(eq(customers.id, id), isNull(customers.anonymizedAt), joinable),
      )
      .returning({ id: customers.id });
    if (updated.length > 0) return "updated";
    const [row] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.anonymizedAt)))
      .limit(1);
    return row ? "not_joinable" : "not_found";
  },

  getCustomerReferrals: async (customerId: string) => {
    const rows = await getDb()
      .select({
        id: customers.id,
        fullName: customers.fullName,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.referredById, customerId))
      .orderBy(asc(customers.createdAt), asc(customers.id));
    return rows.map(toCustomerReferral);
  },

  // Métrique « Parrainages » : inscrits de la période (jour d'inscription en
  // UTC, comme signupDay) et, parmi eux, ceux qui portent un parrain.
  // count(colonne) ignore les NULL : c'est le nombre de parrainés.
  getSignupStats: async (range) => {
    const signupDay = sql`(${customers.createdAt} at time zone 'UTC')::date`;
    const [row] = await getDb()
      .select({ signups: count(), referred: count(customers.referredById) })
      .from(customers)
      .where(
        and(
          sql`${signupDay} >= ${range.from}::date`,
          sql`${signupDay} <= ${range.to}::date`,
        ),
      );
    return { signups: row?.signups ?? 0, referred: row?.referred ?? 0 };
  },

  addNote: (customerId: string, note: Omit<CustomerNote, "id">) =>
    getDb().transaction(async (tx) => {
      // Verrou partagé (FOR SHARE) sur la ligne du client, pour ne jamais
      // laisser une note à un client anonymisé :
      // - anonymisation en cours (UPDATE) : on attend sa fin, la ligne relue
      //   porte anonymized_at, la note est refusée ;
      // - note arrivée la première : l'anonymisation attend la fin de cette
      //   transaction, puis supprime aussi cette note.
      const [exists] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(eq(customers.id, customerId), isNull(customers.anonymizedAt)),
        )
        .limit(1)
        .for("share");
      if (!exists) return null;
      const [row] = await tx
        .insert(customerNotes)
        .values({
          id: randomUUID(),
          customerId,
          text: note.text,
          authorName: note.authorName,
          createdAt: new Date(note.createdAt),
        })
        .returning();
      return row ? toCustomerNote(row) : null;
    }),
};
