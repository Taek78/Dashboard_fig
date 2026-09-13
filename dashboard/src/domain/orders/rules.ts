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
export function computeOrderTotalCents(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.lineTotalCents, 0);
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
    return dateOk && statusOk && customerOk;
  });
}

/**
 * Copie triée par créneau de livraison croissant : date, puis heure de début, puis
 * référence (pour un ordre identique à chaque appel quand deux commandes partagent
 * le même créneau). Les champs sont des chaînes "AAAA-MM-JJ" / "HH:mm" à zéros
 * devant : la comparaison de chaînes suffit, pas de Date. `||` passe à la clé
 * suivante seulement quand la précédente renvoie 0 (égalité).
 */
export function sortOrdersBySlot(orders: readonly Order[]): Order[] {
  return orders.toSorted(
    (a, b) =>
      a.deliverySlot.date.localeCompare(b.deliverySlot.date) ||
      a.deliverySlot.start.localeCompare(b.deliverySlot.start) ||
      a.reference.localeCompare(b.reference),
  );
}
