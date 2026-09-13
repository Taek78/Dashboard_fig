import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";

/*
 * Agrégations pures des métriques (A6, étendues le 2026-09-13), testées dans
 * test/domain/metrics/rules.test.ts : les chiffres affichés sont ceux que ces
 * fonctions calculent. Aucune dépendance à Next ni à recharts.
 *
 * Conventions :
 * - le chiffre d'affaires exclut les commandes annulées ; le panier moyen est
 *   CA / nombre de commandes non annulées ;
 * - les montants des commandes sont TTC (prix affichés au client dans l'appli).
 *   Le HT se déduit avec la TVA réduite alimentaire (5,5 %). À confirmer avec le
 *   client (question Q9 : taux et base de ses montants) ;
 * - toutes les dates sont des jours civils "AAAA-MM-JJ", calculés en UTC.
 */

/* ---------- TVA ---------- */

export const VAT_RATE = 0.055;
export const TAX_MODES = ["ttc", "ht"] as const;
export type TaxMode = (typeof TAX_MODES)[number];
export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  ttc: "TTC",
  ht: "HT",
};

/** TTC → HT, arrondi au centime. */
export function toExcludingTax(cents: number): number {
  return Math.round(cents / (1 + VAT_RATE));
}

export function applyTaxMode(cents: number, mode: TaxMode): number {
  return mode === "ht" ? toExcludingTax(cents) : cents;
}

/* ---------- Dates ---------- */

export type DateRange = { from: string; to: string };

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fromIso(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function addDays(day: string, n: number): string {
  const d = fromIso(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function addMonths(day: string, n: number): string {
  const d = fromIso(day);
  const dayOfMonth = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(dayOfMonth, lastDay));
  return toIso(d);
}

export function addYears(day: string, n: number): string {
  return addMonths(day, 12 * n);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: string): string {
  const d = fromIso(day);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Lundi de la semaine du jour donné. */
export function startOfWeek(day: string): string {
  const d = fromIso(day);
  const offset = (d.getUTCDay() + 6) % 7; // lundi = 0
  return addDays(day, -offset);
}

export function daysBetween(range: DateRange): number {
  return (
    Math.round(
      (fromIso(range.to).getTime() - fromIso(range.from).getTime()) /
        86_400_000,
    ) + 1
  );
}

/* ---------- Périodes ---------- */

export const METRIC_PERIODS = [
  "aujourdhui",
  "hier",
  "semaine-derniere",
  "ce-mois",
  "mois-dernier",
  "90-jours",
  "6-mois",
  "cette-annee",
  "annee-derniere",
  "n-2",
  "n-3",
] as const;
export type MetricPeriod = (typeof METRIC_PERIODS)[number];
export const DEFAULT_PERIOD: MetricPeriod = "ce-mois";

export const METRIC_PERIOD_LABELS: Record<MetricPeriod, string> = {
  aujourdhui: "Aujourd'hui",
  hier: "Hier",
  "semaine-derniere": "La semaine dernière",
  "ce-mois": "Ce mois-ci",
  "mois-dernier": "Le mois dernier",
  "90-jours": "Les 90 derniers jours",
  "6-mois": "Les 6 derniers mois",
  "cette-annee": "Cette année",
  "annee-derniere": "L'année dernière",
  "n-2": "Il y a deux ans (N-2)",
  "n-3": "Il y a trois ans (N-3)",
};

/** Plage de jours (bornes incluses) d'une période prédéfinie, relative à `today`. */
export function periodRange(period: MetricPeriod, today: string): DateRange {
  const year = Number(today.slice(0, 4));
  const fullYear = (y: number): DateRange => ({
    from: `${y}-01-01`,
    to: `${y}-12-31`,
  });
  switch (period) {
    case "aujourdhui":
      return { from: today, to: today };
    case "hier": {
      const d = addDays(today, -1);
      return { from: d, to: d };
    }
    case "semaine-derniere": {
      const monday = addDays(startOfWeek(today), -7);
      return { from: monday, to: addDays(monday, 6) };
    }
    case "ce-mois":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "mois-dernier": {
      const d = addMonths(startOfMonth(today), -1);
      return { from: d, to: endOfMonth(d) };
    }
    case "90-jours":
      return { from: addDays(today, -89), to: today };
    case "6-mois":
      return { from: addDays(addMonths(today, -6), 1), to: today };
    case "cette-annee":
      return fullYear(year);
    case "annee-derniere":
      return fullYear(year - 1);
    case "n-2":
      return fullYear(year - 2);
    case "n-3":
      return fullYear(year - 3);
  }
}

/** La même plage un an plus tôt : la référence N-1 par défaut. */
export function previousYearRange(range: DateRange): DateRange {
  return { from: addYears(range.from, -1), to: addYears(range.to, -1) };
}

/** La plage de même longueur immédiatement avant : l'autre référence possible. */
export function previousPeriodRange(range: DateRange): DateRange {
  const days = daysBetween(range);
  return { from: addDays(range.from, -days), to: addDays(range.to, -days) };
}

export const COMPARISONS = ["n-1", "precedente"] as const;
export type Comparison = (typeof COMPARISONS)[number];
export const COMPARISON_LABELS: Record<Comparison, string> = {
  "n-1": "Même période N-1",
  precedente: "Période précédente",
};

export function referenceRange(range: DateRange, mode: Comparison): DateRange {
  return mode === "n-1" ? previousYearRange(range) : previousPeriodRange(range);
}

/** Clients distincts ayant au moins une commande non annulée. */
export function distinctBuyers(orders: readonly Order[]): number {
  return new Set(
    orders.filter((o) => o.status !== "cancelled").map((o) => o.customer.id),
  ).size;
}

/** Commandes dont le jour de livraison est dans la plage (bornes incluses). */
export function filterByRange(
  orders: readonly Order[],
  range: DateRange,
): Order[] {
  return orders.filter(
    (o) => o.deliverySlot.date >= range.from && o.deliverySlot.date <= range.to,
  );
}

/* ---------- KPI ---------- */

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

/** Variation en pourcentage (arrondie), null si la référence est nulle. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** En deçà de ±0,4 %, une variation est considérée comme nulle (badge neutre). */
export const FLAT_THRESHOLD_PERCENT = 0.4;

export type Trend = {
  direction: "up" | "down" | "flat";
  /** Pourcentage arrondi, 0 pour un plat. */
  percent: number;
};

/**
 * Sens d'une variation pour un badge. Il y a toujours une réponse (décision du
 * 2026-09-13 : pas de tiret « sans référence ») :
 * - flat : valeur manquante, rien vendu des deux côtés, ou variation dans la
 *   bande ±0,4 % ;
 * - up +100 % : référence nulle et valeur courante non nulle (partir de zéro) ;
 * - up / down sinon.
 */
export function computeTrend(
  current: number | null,
  previous: number | null,
): Trend {
  if (current === null || previous === null) {
    return { direction: "flat", percent: 0 };
  }
  if (previous === 0) {
    return current === 0
      ? { direction: "flat", percent: 0 }
      : { direction: "up", percent: 100 };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw);
  if (Math.abs(raw) <= FLAT_THRESHOLD_PERCENT || rounded === 0) {
    return { direction: "flat", percent: 0 };
  }
  return { direction: raw > 0 ? "up" : "down", percent: rounded };
}

/* ---------- Séries temporelles ---------- */

export type Bucket = "day" | "week" | "month";

/** Granularité lisible selon la longueur de la plage : ≤ 31 j → jour, ≤ 190 j → semaine, sinon mois. */
export function bucketFor(range: DateRange): Bucket {
  const days = daysBetween(range);
  if (days <= 31) return "day";
  if (days <= 190) return "week";
  return "month";
}

function bucketStart(day: string, bucket: Bucket): string {
  if (bucket === "day") return day;
  if (bucket === "week") return startOfWeek(day);
  return startOfMonth(day);
}

function nextBucket(start: string, bucket: Bucket): string {
  if (bucket === "day") return addDays(start, 1);
  if (bucket === "week") return addDays(start, 7);
  return addMonths(start, 1);
}

export type SeriesPoint = {
  /** Premier jour du seau. */
  key: string;
  revenueCents: number;
  orderCount: number;
};

/**
 * CA (hors annulées) et volume par seau sur TOUTE la plage, seaux vides compris :
 * deux plages de même longueur donnent deux séries alignées (comparaison N-1).
 */
export function revenueSeries(
  orders: readonly Order[],
  range: DateRange,
  bucket: Bucket,
): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();
  for (
    let start = bucketStart(range.from, bucket);
    start <= range.to;
    start = nextBucket(start, bucket)
  ) {
    points.set(start, { key: start, revenueCents: 0, orderCount: 0 });
  }
  for (const o of filterByRange(orders, range)) {
    const point = points.get(bucketStart(o.deliverySlot.date, bucket));
    if (!point) continue;
    point.orderCount += 1;
    if (o.status !== "cancelled") point.revenueCents += o.totalCents;
  }
  return [...points.values()];
}

export type ComparisonPoint = {
  key: string;
  previousKey: string | null;
  currentCents: number;
  previousCents: number;
  currentOrders: number;
  previousOrders: number;
};

/** Aligne la série courante et la série N-1 seau par seau (par position). */
export function compareSeries(
  current: readonly SeriesPoint[],
  previous: readonly SeriesPoint[],
): ComparisonPoint[] {
  return current.map((p, i) => ({
    key: p.key,
    previousKey: previous[i]?.key ?? null,
    currentCents: p.revenueCents,
    previousCents: previous[i]?.revenueCents ?? 0,
    currentOrders: p.orderCount,
    previousOrders: previous[i]?.orderCount ?? 0,
  }));
}

/* ---------- Répartitions ---------- */

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
