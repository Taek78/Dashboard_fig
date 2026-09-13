import type { Assignment, Courier } from "@/domain/deliveries/types";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";

/*
 * Règles pures des livraisons : aucune dépendance à Next ni à la source de
 * données, testées dans test/domain/deliveries/rules.test.ts. La Server Action
 * assignCourier et la page Livraisons ne font que les brancher.
 */

/** Statuts pour lesquels une attribution a un sens : ni avant confirmation, ni après la fin. */
export const ASSIGNABLE_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "preparing",
  "delivering",
];

export function canBeAssigned(status: OrderStatus): boolean {
  return ASSIGNABLE_STATUSES.includes(status);
}

/**
 * Vrai si `courierId` a déjà une attribution sur le même jour ET la même heure de
 * début, pour une AUTRE commande que `orderId` (réattribuer la même commande n'est
 * jamais un conflit avec elle-même).
 */
export function hasSlotConflict(
  assignments: readonly Assignment[],
  courierId: string,
  slot: { date: string; start: string },
  orderId: string,
): boolean {
  return assignments.some(
    (a) =>
      a.courierId === courierId &&
      a.date === slot.date &&
      a.start === slot.start &&
      a.orderId !== orderId,
  );
}

export type TourEntry = {
  order: Order;
  courier: Courier | null;
  assignable: boolean;
};

/**
 * Tournée d'un jour : chaque commande du jour avec son livreur (ou null), dans
 * l'ordre reçu (déjà trié par créneau par la source). Le croisement se fait ici,
 * une fois, plutôt que dans le composant.
 */
export function buildTour(
  orders: readonly Order[],
  assignments: readonly Assignment[],
  couriers: readonly Courier[],
): TourEntry[] {
  const courierById = new Map(couriers.map((c) => [c.id, c]));
  const courierIdByOrder = new Map(
    assignments.map((a) => [a.orderId, a.courierId]),
  );
  return orders.map((order) => {
    const courierId = courierIdByOrder.get(order.id);
    const courier = courierId ? (courierById.get(courierId) ?? null) : null;
    return { order, courier, assignable: canBeAssigned(order.status) };
  });
}

/** Nombre de commandes attribuables encore sans livreur : le chiffre utile du gestionnaire. */
export function countUnassigned(tour: readonly TourEntry[]): number {
  return tour.filter((e) => e.assignable && e.courier === null).length;
}

/** Jour courant en Europe/Paris au format AAAA-MM-JJ. `now` en paramètre : testable. */
export function todayInParis(now: Date): string {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Jours distincts ayant au moins une commande, triés : les raccourcis de la page. */
export function deliveryDates(orders: readonly Order[]): string[] {
  return [...new Set(orders.map((o) => o.deliverySlot.date))].sort();
}
