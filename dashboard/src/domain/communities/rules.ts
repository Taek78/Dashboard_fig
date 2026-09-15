import type { Community } from "@/domain/communities/types";
import type { Customer } from "@/domain/customers/types";
import type { Order } from "@/domain/orders/types";

/*
 * Règles pures des communautés, testées dans test/domain/communities/rules.test.ts.
 */

/** Copie triée par nom (ordre français), les inactives en fin de liste. */
export function sortCommunities(
  communities: readonly Community[],
): Community[] {
  return communities.toSorted(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "fr"),
  );
}

/** Membres d'une communauté parmi une liste de clients. Ne trie pas. */
export function communityMembers(
  customers: readonly Customer[],
  communityId: string,
): Customer[] {
  return customers.filter((c) => c.community?.id === communityId);
}

/** Commandes rattachées à la communauté (livrées au point de retrait). Ne trie pas. */
export function communityOrders(
  orders: readonly Order[],
  communityId: string,
): Order[] {
  return orders.filter((o) => o.community?.id === communityId);
}

export type CommunitySummary = {
  orderCount: number;
  /** Total dû, hors annulées. */
  totalCents: number;
  /** Somme des remises accordées, hors annulées. */
  discountCents: number;
  lastDeliveryDate: string | null;
};

/** Chiffres d'une communauté à partir de SES commandes (déjà filtrées). */
export function summarizeCommunity(orders: readonly Order[]): CommunitySummary {
  const active = orders.filter((o) => o.status !== "cancelled");
  const dates = orders.map((o) => o.deliverySlot.date).sort();
  return {
    orderCount: orders.length,
    totalCents: active.reduce((s, o) => s + o.totalCents, 0),
    discountCents: active.reduce(
      (s, o) => s + (o.discount?.amountCents ?? 0),
      0,
    ),
    lastDeliveryDate: dates.at(-1) ?? null,
  };
}
