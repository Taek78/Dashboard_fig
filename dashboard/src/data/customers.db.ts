import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
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
} from "@/domain/customers/types";

/*
 * Implémentation Drizzle du contrat CustomersSource. La recherche (nom,
 * e-mail, chiffres du téléphone, sans accents) reste la règle pure du domaine,
 * appliquée après chargement. Le parrain est joint sur la table elle-même
 * (alias « referrer ») ; les filleuls se lisent à part, pour la fiche seule.
 * À passer en SQL (pg_trgm) si la table dépasse quelques milliers de clients.
 */
const referrer = alias(customers, "referrer");

async function loadCustomers(ids?: readonly string[]): Promise<Customer[]> {
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
    ids === undefined
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
