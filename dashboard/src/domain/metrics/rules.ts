import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/domain/orders/status";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import {
  addDays,
  daysBetween,
  fromIso,
  toIso,
  type DateRange,
} from "@/lib/days";

/*
 * Agrégations pures des métriques, testées dans
 * test/domain/metrics/rules.test.ts : les chiffres affichés sont ceux que ces
 * fonctions calculent. Aucune dépendance à Next ni à recharts.
 *
 * Conventions :
 * - le chiffre d'affaires exclut les commandes annulées ; le panier moyen est
 *   CA / nombre de commandes non annulées ;
 * - les montants des commandes sont TTC (prix affichés au client dans l'appli).
 *   Le HT se déduit avec la TVA réduite alimentaire (5,5 %). À confirmer avec le
 *   client (question 10 : taux et base de ses montants) ;
 * - toutes les dates sont des jours civils "AAAA-MM-JJ", calculés en UTC.
 */

/* ---------- TVA ---------- */

export const VAT_RATE = 0.055;
export const TAX_MODES = ["ht", "ttc"] as const;
export type TaxMode = (typeof TAX_MODES)[number];
/** Mode par défaut de toute page qui affiche des montants. */
export const DEFAULT_TAX_MODE: TaxMode = "ht";
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

// Arithmétique des jours partagée avec la tournée des livraisons.
export { addDays, daysBetween, type DateRange } from "@/lib/days";

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

/* ---------- Totaux, KPI et répartitions d'une période ---------- */

export type StatusCounts = Record<OrderStatus, number>;

/** Nombre de commandes par statut, chaque statut présent (0 compris). */
export function countByStatus(orders: readonly Order[]): StatusCounts {
  const counts = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  ) as StatusCounts;
  for (const o of orders) counts[o.status] += 1;
  return counts;
}

/**
 * Totaux BRUTS d'une période : ce qu'une requête SQL agrégée renvoie
 * (src/data/orders-aggregates.db.ts) et ce que orderTotals() calcule en
 * mémoire. Les chiffres affichés en sont tirés par statsFromTotals, une seule
 * fois : mêmes arrondis quelle que soit l'origine des totaux.
 */
export type OrderTotals = {
  statusCounts: StatusCounts;
  /** CA hors annulées. */
  revenueCents: number;
  /** Commandes de membres d'une communauté, annulées comprises. */
  communityCount: number;
  /** Clients distincts ayant au moins une commande non annulée. */
  buyers: number;
};

export type Kpis = {
  orderCount: number;
  revenueCents: number;
  averageBasketCents: number;
  cancelledCount: number;
  /** Commandes encore en préparation (le travail qui reste à l'atelier). */
  preparingCount: number;
};

/** Tout ce que le tableau de bord et les métriques affichent d'une période. */
export type OrderStats = {
  kpis: Kpis;
  statusCounts: StatusCounts;
  share: CommunityShare;
  buyers: number;
};

/** Totaux d'une liste de commandes déjà bornée à la période. */
export function orderTotals(orders: readonly Order[]): OrderTotals {
  return {
    statusCounts: countByStatus(orders),
    revenueCents: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalCents, 0),
    communityCount: orders.filter((o) => o.community !== null).length,
    buyers: distinctBuyers(orders),
  };
}

export function statsFromTotals(totals: OrderTotals): OrderStats {
  const orderCount = ORDER_STATUSES.reduce(
    (sum, status) => sum + totals.statusCounts[status],
    0,
  );
  const cancelledCount = totals.statusCounts.cancelled;
  const active = orderCount - cancelledCount;
  return {
    kpis: {
      orderCount,
      revenueCents: totals.revenueCents,
      averageBasketCents:
        active === 0 ? 0 : Math.round(totals.revenueCents / active),
      cancelledCount,
      preparingCount: totals.statusCounts.preparing,
    },
    statusCounts: totals.statusCounts,
    share: communityShareFrom(totals.communityCount, orderCount),
    buyers: totals.buyers,
  };
}

export function orderStats(orders: readonly Order[]): OrderStats {
  return statsFromTotals(orderTotals(orders));
}

export function computeKpis(orders: readonly Order[]): Kpis {
  return orderStats(orders).kpis;
}

/* ---------- Communautés ---------- */

export type CommunityShare = {
  /** Commandes de membres d'une communauté (retrait au point de la communauté). */
  community: number;
  /** Commandes de particuliers. */
  individual: number;
  /** Part des commandes de communauté, en pourcentage arrondi ; null sans commande. */
  percent: number | null;
};

/** Répartition à partir des nombres : `community` commandes de communauté sur `total`. */
export function communityShareFrom(
  community: number,
  total: number,
): CommunityShare {
  return {
    community,
    individual: total - community,
    percent: total === 0 ? null : Math.round((community / total) * 100),
  };
}

/** Répartition des commandes (annulées comprises) entre communautés et particuliers. */
export function communityShare(orders: readonly Order[]): CommunityShare {
  return communityShareFrom(
    orders.filter((o) => o.community !== null).length,
    orders.length,
  );
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
 * Sens d'une variation pour un badge. Il y a toujours une réponse (jamais de
 * tiret « sans référence ») :
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

/** Les mesures que le graphe d'évolution sait tracer. */
export const CHART_METRICS = [
  "revenue",
  "orders",
  "basket",
  "cancelled",
  "buyers",
] as const;
export type ChartMetric = (typeof CHART_METRICS)[number];
export const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  revenue: "Chiffre d'affaires",
  orders: "Commandes",
  basket: "Panier moyen",
  cancelled: "Annulations",
  buyers: "Acheteurs",
};
/** Montant (à formater en euros, soumis au mode HT/TTC) ou simple compte. */
export const CHART_METRIC_KINDS: Record<ChartMetric, "money" | "count"> = {
  revenue: "money",
  orders: "count",
  basket: "money",
  cancelled: "count",
  buyers: "count",
};

/** Ce qu'un seau de temps porte : les cinq mesures du graphe. */
export type SeriesValues = {
  /** CA hors annulées. */
  revenueCents: number;
  orderCount: number;
  cancelledCount: number;
  /** CA / commandes non annulées du seau, 0 sans commande. */
  averageBasketCents: number;
  /** Clients distincts ayant commandé (hors annulées) dans le seau. */
  buyers: number;
};

export type SeriesPoint = SeriesValues & {
  /** Premier jour du seau. */
  key: string;
};

export const EMPTY_SERIES_VALUES: SeriesValues = {
  revenueCents: 0,
  orderCount: 0,
  cancelledCount: 0,
  averageBasketCents: 0,
  buyers: 0,
};

/**
 * Totaux BRUTS d'un seau (clé = premier jour : le jour, le lundi ou le 1er du
 * mois), tels que la base les agrège ou que revenueSeries les compte.
 */
export type BucketTotals = {
  key: string;
  orderCount: number;
  cancelledCount: number;
  /** CA hors annulées. */
  revenueCents: number;
  /** Clients distincts hors annulées. */
  buyers: number;
};

/**
 * Les cinq mesures par seau sur TOUTE la plage, seaux vides compris : deux
 * plages de même longueur donnent deux séries alignées (comparaison N-1). Le
 * panier moyen est calculé ici, une seule fois.
 */
export function fillSeries(
  range: DateRange,
  bucket: Bucket,
  totals: readonly BucketTotals[],
): SeriesPoint[] {
  const byKey = new Map(totals.map((t) => [t.key, t]));
  const points: SeriesPoint[] = [];
  for (
    let start = bucketStart(range.from, bucket);
    start <= range.to;
    start = nextBucket(start, bucket)
  ) {
    const t = byKey.get(start);
    if (!t) {
      points.push({ key: start, ...EMPTY_SERIES_VALUES });
      continue;
    }
    const active = t.orderCount - t.cancelledCount;
    points.push({
      key: start,
      revenueCents: t.revenueCents,
      orderCount: t.orderCount,
      cancelledCount: t.cancelledCount,
      averageBasketCents:
        active === 0 ? 0 : Math.round(t.revenueCents / active),
      buyers: t.buyers,
    });
  }
  return points;
}

/** Série calculée en mémoire à partir de commandes (règle de référence de la version SQL). */
export function revenueSeries(
  orders: readonly Order[],
  range: DateRange,
  bucket: Bucket,
): SeriesPoint[] {
  const totals = new Map<string, BucketTotals & { customers: Set<string> }>();
  for (const o of filterByRange(orders, range)) {
    const key = bucketStart(o.deliverySlot.date, bucket);
    const t = totals.get(key) ?? {
      key,
      orderCount: 0,
      cancelledCount: 0,
      revenueCents: 0,
      buyers: 0,
      customers: new Set<string>(),
    };
    t.orderCount += 1;
    if (o.status === "cancelled") {
      t.cancelledCount += 1;
    } else {
      t.revenueCents += o.totalCents;
      t.customers.add(o.customer.id);
    }
    totals.set(key, t);
  }
  return fillSeries(
    range,
    bucket,
    [...totals.values()].map(({ customers, ...t }) => ({
      ...t,
      buyers: customers.size,
    })),
  );
}

export type ComparisonPoint = {
  key: string;
  previousKey: string | null;
  current: SeriesValues;
  previous: SeriesValues;
};

/** Aligne la série courante et la série de référence seau par seau (par position). */
export function compareSeries(
  current: readonly SeriesPoint[],
  previous: readonly SeriesPoint[],
): ComparisonPoint[] {
  return current.map(({ key, ...values }, i) => {
    const ref = previous[i];
    const { key: previousKey, ...previousValues } = ref ?? {
      key: null,
      ...EMPTY_SERIES_VALUES,
    };
    return { key, previousKey, current: values, previous: previousValues };
  });
}

/** La valeur d'une mesure dans un seau. */
export function seriesValue(values: SeriesValues, metric: ChartMetric): number {
  switch (metric) {
    case "revenue":
      return values.revenueCents;
    case "orders":
      return values.orderCount;
    case "basket":
      return values.averageBasketCents;
    case "cancelled":
      return values.cancelledCount;
    case "buyers":
      return values.buyers;
  }
}

/** Applique le mode HT/TTC aux seules mesures monétaires d'un seau. */
export function applyTaxToValues(
  values: SeriesValues,
  mode: TaxMode,
): SeriesValues {
  return {
    ...values,
    revenueCents: applyTaxMode(values.revenueCents, mode),
    averageBasketCents: applyTaxMode(values.averageBasketCents, mode),
  };
}

/* ---------- Répartitions ---------- */

export type StatusPoint = { status: OrderStatus; label: string; count: number };

/** Une entrée par statut, dans l'ordre du cycle de vie, même à zéro. */
export function statusPoints(counts: StatusCounts): StatusPoint[] {
  return ORDER_STATUSES.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: counts[status],
  }));
}

export function ordersByStatus(orders: readonly Order[]): StatusPoint[] {
  return statusPoints(countByStatus(orders));
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
  return rankProducts([...byProduct.values()], limit);
}

/** Classement des produits : CA décroissant, puis nom (ordre français), `limit` premiers. */
export function rankProducts(
  points: readonly ProductPoint[],
  limit: number,
): ProductPoint[] {
  return points
    .toSorted(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        a.productName.localeCompare(b.productName, "fr"),
    )
    .slice(0, limit);
}
