import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";

/*
 * Agrégations pures des métriques (A6), testées dans
 * test/domain/metrics/rules.test.ts : les chiffres affichés à l'écran sont ceux
 * que ces fonctions calculent sur les fixtures. Aucune dépendance à Next ni à
 * recharts : les composants graphiques ne font que dessiner ces résultats.
 *
 * Convention : le chiffre d'affaires exclut les commandes annulées ; le panier
 * moyen est CA / nombre de commandes non annulées.
 */
export const METRIC_PERIODS = ["7", "30", "tout"] as const;
export type MetricPeriod = (typeof METRIC_PERIODS)[number];
export const METRIC_PERIOD_LABELS: Record<MetricPeriod, string> = {
  "7": "7 derniers jours",
  "30": "30 derniers jours",
  tout: "Tout l'historique",
};

/** Jour AAAA-MM-JJ situé `days` jours avant `today` (calcul en UTC sur des dates civiles). */
export function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Commandes dont le jour de livraison est dans la période (bornes incluses). */
export function filterByPeriod(
  orders: readonly Order[],
  period: MetricPeriod,
  today: string,
): Order[] {
  if (period === "tout") return [...orders];
  const from = daysBefore(today, Number(period) - 1);
  return orders.filter(
    (o) => o.deliverySlot.date >= from && o.deliverySlot.date <= today,
  );
}

export type Kpis = {
  orderCount: number;
  revenueCents: number;
  averageBasketCents: number;
  cancelledCount: number;
  pendingCount: number;
};

export function computeKpis(orders: readonly Order[]): Kpis {
  const active = orders.filter((o) => o.status !== "cancelled");
  const revenueCents = active.reduce((sum, o) => sum + o.totalCents, 0);
  return {
    orderCount: orders.length,
    revenueCents,
    averageBasketCents:
      active.length === 0 ? 0 : Math.round(revenueCents / active.length),
    cancelledCount: orders.length - active.length,
    pendingCount: orders.filter((o) => o.status === "pending").length,
  };
}

export type DayPoint = {
  date: string;
  revenueCents: number;
  orderCount: number;
};

/** CA (hors annulées) et volume par jour de livraison, jours triés. */
export function revenueByDay(orders: readonly Order[]): DayPoint[] {
  const byDay = new Map<string, DayPoint>();
  for (const o of orders) {
    const date = o.deliverySlot.date;
    const point = byDay.get(date) ?? { date, revenueCents: 0, orderCount: 0 };
    point.orderCount += 1;
    if (o.status !== "cancelled") point.revenueCents += o.totalCents;
    byDay.set(date, point);
  }
  return [...byDay.values()].toSorted((a, b) => a.date.localeCompare(b.date));
}

export type StatusPoint = { status: OrderStatus; label: string; count: number };

/** Une entrée par statut, dans l'ordre du cycle de vie, même à zéro. */
export function ordersByStatus(orders: readonly Order[]): StatusPoint[] {
  return ORDER_STATUSES.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: orders.filter((o) => o.status === status).length,
  }));
}

export type ProductPoint = {
  productId: string;
  productName: string;
  revenueCents: number;
  quantity: number;
  unit: "piece" | "g";
};

/** Produits les plus vendus (hors annulées), par CA décroissant, `limit` premiers. */
export function topProducts(
  orders: readonly Order[],
  limit: number,
): ProductPoint[] {
  const byProduct = new Map<string, ProductPoint>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    for (const line of o.lines) {
      const point = byProduct.get(line.productId) ?? {
        productId: line.productId,
        productName: line.productName,
        revenueCents: 0,
        quantity: 0,
        unit: line.unit,
      };
      point.revenueCents += line.lineTotalCents;
      point.quantity += line.quantity;
      byProduct.set(line.productId, point);
    }
  }
  return [...byProduct.values()]
    .toSorted(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        a.productName.localeCompare(b.productName, "fr"),
    )
    .slice(0, limit);
}
