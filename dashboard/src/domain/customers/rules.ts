import type { Customer, CustomerFilters } from "@/domain/customers/types";
import type { Order } from "@/domain/orders/types";
import { digitsOnly, normalize } from "@/lib/text";

/*
 * Règles pures des clients, testées dans test/domain/customers/rules.test.ts.
 */

/**
 * Recherche sur nom, e-mail ou téléphone. Insensible à la casse et aux accents ;
 * le téléphone se compare chiffres seuls ("0639" trouve "06 39 98 00 01").
 * Requête vide → tout.
 */
export function searchCustomers(
  customers: readonly Customer[],
  query: string | undefined,
): Customer[] {
  const q = query ? normalize(query) : "";
  if (q === "") return [...customers];
  const qDigits = digitsOnly(q);
  return customers.filter(
    (c) =>
      normalize(c.fullName).includes(q) ||
      normalize(c.email).includes(q) ||
      (qDigits.length >= 2 && digitsOnly(c.phone).includes(qDigits)),
  );
}

/**
 * Applique tous les filtres présents : recherche (searchCustomers), puis
 * particuliers / membres d'une communauté, puis une communauté précise. Un
 * critère absent laisse tout passer.
 */
export function filterCustomers(
  customers: readonly Customer[],
  filters: CustomerFilters,
): Customer[] {
  return searchCustomers(customers, filters.query).filter((c) => {
    const membershipOk =
      filters.membership === undefined ||
      (filters.membership === "individual"
        ? c.community === null
        : c.community !== null);
    const communityOk =
      filters.communityId === undefined ||
      c.community?.id === filters.communityId;
    return membershipOk && communityOk;
  });
}

/** Copie triée par nom (ordre français). */
export function sortCustomersByName(
  customers: readonly Customer[],
): Customer[] {
  return customers.toSorted((a, b) =>
    a.fullName.localeCompare(b.fullName, "fr"),
  );
}

export type CustomerStats = {
  orderCount: number;
  /** Somme des commandes non annulées. */
  totalSpentCents: number;
  /** Date de livraison la plus récente, ou null. */
  lastDeliveryDate: string | null;
};

/** Statistiques d'un client à partir de SES commandes (déjà filtrées par customerId). */
export function computeCustomerStats(orders: readonly Order[]): CustomerStats {
  const active = orders.filter((o) => o.status !== "cancelled");
  const dates = orders.map((o) => o.deliverySlot.date).sort();
  return {
    orderCount: orders.length,
    totalSpentCents: active.reduce((sum, o) => sum + o.totalCents, 0),
    lastDeliveryDate: dates.at(-1) ?? null,
  };
}

/** Notes les plus récentes en premier, sans muter l'entrée. */
export function sortNotesNewestFirst<T extends { createdAt: string }>(
  notes: readonly T[],
): T[] {
  return notes.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
