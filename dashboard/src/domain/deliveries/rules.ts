import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import { addDays, daysBetween } from "@/lib/days";

/*
 * Règles pures des livraisons : la tournée se lit et se pilote par le statut
 * des commandes, sur une période de quelques jours groupée par jour. Testées
 * dans test/domain/deliveries/rules.test.ts.
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

/* ---------- Période et raccourcis ---------- */

/** Période maximale de la page Livraisons : une semaine de tournées. */
export const TOUR_MAX_DAYS = 7;

export type TourRange = { from: string; to: string; clamped: boolean };

/**
 * Période affichée par la page Livraisons à partir des filtres de l'URL (déjà
 * remis dans l'ordre par parseOrderFilters) : aujourd'hui sans date, un seul jour
 * quand une seule borne est donnée, et jamais plus de `maxDays` jours (la fin
 * est ramenée, `clamped` le signale pour l'écran).
 */
export function tourRange(
  filters: { from?: string; to?: string },
  today: string,
  maxDays = TOUR_MAX_DAYS,
): TourRange {
  const from = filters.from ?? filters.to ?? today;
  const to = filters.to ?? from;
  if (daysBetween({ from, to }) <= maxDays) return { from, to, clamped: false };
  return { from, to: addDays(from, maxDays - 1), clamped: true };
}

export type DayCount = { date: string; count: number };

/**
 * Raccourcis de la page : les `count` derniers jours jusqu'à aujourd'hui
 * inclus, du plus ancien au plus récent, chacun avec son nombre de livraisons
 * (0 compris : un jour sans commande reste visible et cliquable).
 */
export function recentDeliveryDays(
  orders: readonly Order[],
  today: string,
  count = TOUR_MAX_DAYS,
): DayCount[] {
  const perDay = new Map<string, number>();
  for (const o of orders) {
    perDay.set(o.deliverySlot.date, (perDay.get(o.deliverySlot.date) ?? 0) + 1);
  }
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1);
    return { date, count: perDay.get(date) ?? 0 };
  });
}

export type DayGroup = { date: string; orders: Order[] };

/** Regroupe par jour de livraison, jours croissants ; l'ordre des commandes d'un jour est conservé. */
export function groupOrdersByDay(orders: readonly Order[]): DayGroup[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    const list = groups.get(o.deliverySlot.date) ?? [];
    list.push(o);
    groups.set(o.deliverySlot.date, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, orders: list }));
}

/* ---------- Avancement ---------- */

/** Ordre des segments de la barre : ce qui est terminé à gauche, ce qui reste à droite. */
export const TOUR_STAGES = [
  "delivered",
  "cancelled",
  "delivering",
  "preparing",
] as const satisfies readonly OrderStatus[];

/** Libellés de la légende de l'avancement, au pluriel de la tournée. */
export const TOUR_STAGE_LABELS: Record<OrderStatus, string> = {
  delivered: "Livrées",
  cancelled: "Annulées",
  delivering: "Expédiées",
  preparing: "En préparation",
};

export type TourProgress = {
  total: number;
  /** Livrées + annulées : plus rien à faire. */
  done: number;
  remaining: number;
  /** Part traitée, arrondie à l'entier (0 sans commande). */
  percentDone: number;
  /** Un segment par statut présent, dans l'ordre de TOUR_STAGES. */
  segments: { status: OrderStatus; count: number }[];
};

/**
 * Avancement à partir du nombre de commandes par statut (tel qu'une requête
 * agrégée le renvoie) : compteurs et segments de la barre.
 */
export function tourProgressFromCounts(
  counts: Partial<Record<OrderStatus, number>>,
): TourProgress {
  const count = (status: OrderStatus) => counts[status] ?? 0;
  const total = TOUR_STAGES.reduce((sum, status) => sum + count(status), 0);
  const done = count("delivered") + count("cancelled");
  return {
    total,
    done,
    remaining: total - done,
    percentDone: total === 0 ? 0 : Math.round((done / total) * 100),
    segments: TOUR_STAGES.flatMap((status) =>
      count(status) > 0 ? [{ status, count: count(status) }] : [],
    ),
  };
}

/** Avancement d'un ensemble de livraisons déjà chargées. */
export function tourProgress(orders: readonly Order[]): TourProgress {
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return tourProgressFromCounts(counts);
}

/* ---------- Écran de terrain ---------- */

/** Le geste naturel suivant en tournée, ou null quand la commande est terminée. */
export function nextDeliveryStep(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "preparing":
      return "delivering";
    case "delivering":
      return "delivered";
    default:
      return null;
  }
}

/**
 * Libellé du bouton d'action pour le statut visé. « En préparation » n'est
 * jamais une cible (c'est l'état d'arrivée d'une commande) : son libellé ne
 * sert qu'à compléter le Record.
 */
export const DELIVERY_STEP_LABELS: Record<OrderStatus, string> = {
  preparing: "Remettre en préparation",
  delivering: "Expédier la commande",
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
