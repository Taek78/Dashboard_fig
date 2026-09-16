import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import { addDays } from "@/lib/days";

/*
 * Règles pures des livraisons : le suivi des commandes à livrer se pilote par
 * leur statut, depuis la liste des commandes (la section Livraisons a été
 * fondue dans Commandes le 2026-09-16 : elle en était une copie). Restent ici
 * le jour de Paris, les raccourcis des derniers jours, l'avancement segmenté
 * par statut (tableau de bord), le geste suivant et l'itinéraire. Testées
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

/* ---------- Raccourcis des derniers jours ---------- */

/** Nombre de jours des raccourcis de la liste des commandes : une semaine. */
export const RECENT_DAYS = 7;

export type DayCount = { date: string; count: number };

/**
 * Raccourcis de la liste des commandes : les `count` derniers jours jusqu'à
 * aujourd'hui inclus, du plus ancien au plus récent, chacun avec son nombre de
 * livraisons (0 compris : un jour sans commande reste visible et cliquable).
 */
export function recentDeliveryDays(
  orders: readonly Order[],
  today: string,
  count = RECENT_DAYS,
): DayCount[] {
  const perDay = new Map<string, number>();
  for (const o of orders) {
    perDay.set(o.deliverySlot.date, (perDay.get(o.deliverySlot.date) ?? 0) + 1);
  }
  return recentDeliveryDaysFromCounts(perDay, today, count);
}

/** Les mêmes raccourcis à partir du nombre de livraisons par jour (compté par la base). */
export function recentDeliveryDaysFromCounts(
  perDay: ReadonlyMap<string, number>,
  today: string,
  count = RECENT_DAYS,
): DayCount[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1);
    return { date, count: perDay.get(date) ?? 0 };
  });
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

/**
 * Lien d'itinéraire vers l'adresse (Google Maps, ouvre l'application sur
 * téléphone) : la rue quand la commande la porte, sinon le code postal et la
 * ville seuls.
 */
export function itineraryUrl(
  postalCode: string,
  city: string,
  addressLine: string | null = null,
): string {
  const query = encodeURIComponent(
    `${addressLine ? `${addressLine}, ` : ""}${postalCode} ${city}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
