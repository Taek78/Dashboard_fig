import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";

/*
 * Règles pures des livraisons : la tournée se lit et se pilote par le statut des
 * commandes (pas d'attribution de livreur, choix du client). Testées dans
 * test/domain/deliveries/rules.test.ts.
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

/* ---------- Écran de terrain ---------- */

/** Le geste naturel suivant en tournée, ou null quand la commande est terminée. */
export function nextDeliveryStep(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "preparing";
    case "preparing":
      return "delivering";
    case "delivering":
      return "delivered";
    default:
      return null;
  }
}

/** Libellé du bouton d'action pour le statut visé. */
export const DELIVERY_STEP_LABELS: Record<OrderStatus, string> = {
  pending: "Remettre en attente",
  confirmed: "Confirmer la commande",
  preparing: "Passer en préparation",
  delivering: "Démarrer la livraison",
  delivered: "Marquer comme livrée",
  cancelled: "Annuler la commande",
};

/** Indice de la prochaine livraison à faire (première non terminée), ou -1. */
export function nextStopIndex(orders: readonly Order[]): number {
  return orders.findIndex(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  );
}

/**
 * Lien d'itinéraire vers l'adresse (Google Maps, ouvre l'application sur
 * téléphone). Les fixtures n'ont que le code postal et la ville ; la rue
 * viendra avec la base du client.
 */
export function itineraryUrl(postalCode: string, city: string): string {
  const query = encodeURIComponent(`${postalCode} ${city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
