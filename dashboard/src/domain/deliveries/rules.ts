import type { Order } from "@/domain/orders/types";

/*
 * Règles pures des livraisons (A3, réduites le 2026-09-13 : l'attribution de
 * livreur a été retirée à la demande du client ; la tournée se lit et se pilote
 * par le statut des commandes). Testées dans test/domain/deliveries/rules.test.ts.
 */

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

export type TourSummary = {
  total: number;
  toConfirm: number;
  inProgress: number;
  done: number;
};

/** Compteurs de la tournée : à confirmer (pending), en cours (confirmée → en livraison), terminées. */
export function summarizeTour(orders: readonly Order[]): TourSummary {
  let toConfirm = 0;
  let inProgress = 0;
  let done = 0;
  for (const o of orders) {
    if (o.status === "pending") toConfirm += 1;
    else if (o.status === "delivered" || o.status === "cancelled") done += 1;
    else inProgress += 1;
  }
  return { total: orders.length, toConfirm, inProgress, done };
}
