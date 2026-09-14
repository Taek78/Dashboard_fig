import type { OrderDiscount } from "@/domain/orders/discount";
import type { OrderLine, Order, OrderFilters } from "@/domain/orders/types";

/*
 * Logique pure des commandes.
 *
 * Pourquoi un fichier séparé des composants et de la source de données : aucune
 * dépendance à Next, à la base ni au navigateur, donc testable avec Vitest en
 * quelques millisecondes et réutilisable par le mock comme par la version Drizzle.
 * Les composants et les Server Actions ne font que brancher ces fonctions.
 *
 * Chaque fonction RENVOIE une valeur : elle ne modifie rien. L'appelant stocke ou
 * compare le résultat.
 */

/** Somme des totaux de ligne. Pas de règle prix × quantité : elle dépend du client. */
export function computeOrderSubtotalCents(lines: readonly OrderLine[]): number {
  return lines.reduce((total, line) => total + line.lineTotalCents, 0);
}

/** Total dû : le sous-total moins la remise éventuelle, jamais négatif. */
export function computeOrderTotalCents(
  lines: readonly OrderLine[],
  discount: OrderDiscount | null = null,
): number {
  return Math.max(
    0,
    computeOrderSubtotalCents(lines) - (discount?.amountCents ?? 0),
  );
}

/**
 * Garde les commandes qui passent TOUS les filtres présents. Un critère absent
 * (undefined) laisse tout passer : le cas « aucun filtre » n'a pas besoin d'être
 * traité à part. Ne trie pas : c'est le rôle de sortOrdersBySlot.
 */
export function filterOrders(
  orders: readonly Order[],
  filters: OrderFilters,
): Order[] {
  return orders.filter((order) => {
    const statusOk =
      filters.status === undefined || order.status === filters.status;
    const dateOk =
      filters.date === undefined || order.deliverySlot.date === filters.date;
    const customerOk =
      filters.customerId === undefined ||
      order.customer.id === filters.customerId;
    const communityOk =
      filters.communityId === undefined ||
      order.community?.id === filters.communityId;
    return dateOk && statusOk && customerOk && communityOk;
  });
}

/**
 * Copie triée par créneau de livraison (croissant par défaut, décroissant pour
 * une liste « les plus récentes d'abord ») : date, puis heure de début, puis
 * référence (pour un ordre identique à chaque appel quand deux commandes partagent
 * le même créneau). Les champs sont des chaînes "AAAA-MM-JJ" / "HH:mm" à zéros
 * devant : la comparaison de chaînes suffit, pas de Date. `||` passe à la clé
 * suivante seulement quand la précédente renvoie 0 (égalité).
 */
export function sortOrdersBySlot(
  orders: readonly Order[],
  direction: "asc" | "desc" = "asc",
): Order[] {
  const sign = direction === "asc" ? 1 : -1;
  return orders.toSorted(
    (a, b) =>
      sign *
      (a.deliverySlot.date.localeCompare(b.deliverySlot.date) ||
        a.deliverySlot.start.localeCompare(b.deliverySlot.start) ||
        a.reference.localeCompare(b.reference)),
  );
}

/** Taille d'une page de la liste des commandes : assez pour balayer, pas de quoi noyer. */
export const ORDERS_PAGE_SIZE = 40;

export type Page<T> = {
  items: T[];
  /** Numéro demandé, ramené dans [1, pageCount]. */
  page: number;
  pageCount: number;
  total: number;
};

/**
 * Découpe une liste en pages. Un numéro hors bornes est ramené à la dernière
 * page (ou la première) plutôt que de renvoyer une page vide.
 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  size = ORDERS_PAGE_SIZE,
): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
    total: items.length,
  };
}
