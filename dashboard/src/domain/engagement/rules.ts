import type { EngagementPoint } from "@/domain/engagement/types";
import type { DateRange } from "@/domain/metrics/rules";

/*
 * Agrégations pures des statistiques d'usage, testées dans
 * test/domain/engagement/rules.test.ts.
 */
export type EngagementSummary = {
  downloads: number;
  signups: number;
  /** Moyenne pondérée par le nombre d'avis sur la plage ; null sans avis. */
  rating: number | null;
  ratingCount: number;
};

/** Mois "AAAA-MM" couverts par la plage, même partiellement. */
export function monthsInRange(range: DateRange): string[] {
  const months: string[] = [];
  let cursor = range.from.slice(0, 7);
  const last = range.to.slice(0, 7);
  while (cursor <= last) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number) as [number, number];
    cursor =
      m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return months;
}

export function summarizeEngagement(
  points: readonly EngagementPoint[],
  range: DateRange,
): EngagementSummary {
  const months = new Set(monthsInRange(range));
  const selected = points.filter((p) => months.has(p.month));
  const ratingCount = selected.reduce((s, p) => s + p.ratingCount, 0);
  const weighted = selected.reduce(
    (s, p) => s + (p.rating ?? 0) * p.ratingCount,
    0,
  );
  return {
    downloads: selected.reduce((s, p) => s + p.downloads, 0),
    signups: selected.reduce((s, p) => s + p.signups, 0),
    rating:
      ratingCount === 0
        ? null
        : Math.round((weighted / ratingCount) * 100) / 100,
    ratingCount,
  };
}

/** Pourcentage arrondi de `part` dans `total`, null si le total est nul. */
export function ratioPercent(part: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((part / total) * 100);
}
