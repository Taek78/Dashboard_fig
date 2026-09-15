import type { StaffRef } from "@/domain/orders/assignment";
import type { OrderDiscount } from "@/domain/orders/discount";
import {
  UNASSIGNED_FILTER,
  type Order,
  type OrderFilters,
  type OrderLine,
} from "@/domain/orders/types";
import { digitsOnly, isPhoneLike, normalize } from "@/lib/text";

/*
 * Logique pure des commandes.
 *
 * Pourquoi un fichier séparé des composants et de la source de données : aucune
 * dépendance à Next, à la base ni au navigateur, donc testable avec Vitest en
 * quelques millisecondes, et réutilisable par la source PostgreSQL et les écrans.
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
 * Vrai si la commande correspond à la recherche libre : référence, nom du
 * client, e-mail, ville ou code postal, sans accents ni majuscules ; ou chiffres
 * du téléphone quand la saisie ressemble à un numéro ("00 07" trouve
 * "06 39 98 00 07", mais « FIG-2609 » ne cherche pas dans les téléphones).
 * Recherche vide ou absente : tout correspond.
 */
export function matchesOrderQuery(
  order: Order,
  query: string | undefined,
): boolean {
  const q = normalize(query ?? "");
  if (q === "") return true;
  const fields = [
    order.reference,
    order.customer.fullName,
    order.customer.email,
    order.deliveryCity,
    order.deliveryPostalCode,
  ];
  if (fields.some((field) => normalize(field).includes(q))) return true;
  const qDigits = digitsOnly(q);
  return (
    isPhoneLike(q) &&
    qDigits.length >= 2 &&
    digitsOnly(order.customer.phone).includes(qDigits)
  );
}

/** Filtre d'équipe : absent = tout, null = personne d'affecté, sinon cette personne. */
function staffMatches(
  ref: StaffRef | null,
  wanted: string | null | undefined,
): boolean {
  if (wanted === undefined) return true;
  return wanted === null ? ref === null : ref?.id === wanted;
}

/**
 * Garde les commandes qui passent TOUS les filtres présents. Un critère absent
 * (undefined) laisse tout passer : le cas « aucun filtre » n'a pas besoin d'être
 * traité à part. Les jours sont des chaînes "AAAA-MM-JJ" : la comparaison de
 * chaînes borne la période. Ne trie pas : c'est le rôle de sortOrdersBySlot.
 */
export function filterOrders(
  orders: readonly Order[],
  filters: OrderFilters,
): Order[] {
  return orders.filter((order) => {
    const day = order.deliverySlot.date;
    return (
      (filters.status === undefined || order.status === filters.status) &&
      (filters.from === undefined || day >= filters.from) &&
      (filters.to === undefined || day <= filters.to) &&
      (filters.customerId === undefined ||
        order.customer.id === filters.customerId) &&
      (filters.communityId === undefined ||
        order.community?.id === filters.communityId) &&
      (filters.staffId === undefined ||
        order.preparer?.id === filters.staffId ||
        order.driver?.id === filters.staffId) &&
      staffMatches(order.preparer, filters.preparerId) &&
      staffMatches(order.driver, filters.driverId) &&
      matchesOrderQuery(order, filters.query)
    );
  });
}

/** Vrai si un filtre de la barre (recherche, statut, période, équipe) est actif. */
export function hasOrderFilters(filters: OrderFilters): boolean {
  return (
    filters.query !== undefined ||
    filters.status !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.preparerId !== undefined ||
    filters.driverId !== undefined
  );
}

/**
 * Filtres de la barre → paramètres d'URL, avec les clés françaises que
 * parseOrderFilters relit : la pagination et les raccourcis de jours gardent la
 * recherche en cours. customerId et communityId ne passent jamais par l'URL.
 */
export function orderFiltersQuery(filters: OrderFilters): string {
  const staff = (id: string | null | undefined) =>
    id === null ? UNASSIGNED_FILTER : id;
  const entries: [string, string | undefined][] = [
    ["q", filters.query],
    ["statut", filters.status],
    ["du", filters.from],
    ["au", filters.to],
    ["preparateur", staff(filters.preparerId)],
    ["livreur", staff(filters.driverId)],
  ];
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
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
  const window = pageWindow(items.length, page, size);
  return {
    items: items.slice(window.offset, window.offset + size),
    page: window.page,
    pageCount: window.pageCount,
    total: items.length,
  };
}

/**
 * Bornes d'une page sur `total` éléments : numéro ramené dans [1, pageCount]
 * et rang du premier élément. Partagé par paginate (en mémoire) et la
 * pagination SQL (LIMIT / OFFSET) : même page pour la même demande.
 */
export function pageWindow(
  total: number,
  page: number,
  size = ORDERS_PAGE_SIZE,
): { page: number; pageCount: number; offset: number } {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { page: current, pageCount, offset: (current - 1) * size };
}
