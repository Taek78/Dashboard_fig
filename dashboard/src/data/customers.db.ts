import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCustomer, toCustomerNote } from "@/db/mappers";
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
 * appliquée après chargement.
 * À passer en SQL (pg_trgm) si la table dépasse quelques milliers de clients.
 */
async function loadCustomers(ids?: readonly string[]): Promise<Customer[]> {
  const db = getDb();
  const base = db
    .select({
      customer: customers,
      community: { id: communities.id, name: communities.name },
    })
    .from(customers)
    .leftJoin(communities, eq(customers.communityId, communities.id));
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
    toCustomer(r.customer, byCustomer.get(r.customer.id) ?? [], r.community),
  );
}

export const customersDb: CustomersSource = {
  getCustomers: async (filters: CustomerFilters = {}) =>
    sortCustomersByName(filterCustomers(await loadCustomers(), filters)),

  getCustomer: async (id: string) => {
    const [customer] = await loadCustomers([id]);
    return customer ?? null;
  },

  addNote: async (customerId: string, note: Omit<CustomerNote, "id">) => {
    const db = getDb();
    const [exists] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!exists) return null;
    const [row] = await db
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
  },
};
