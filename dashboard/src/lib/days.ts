/*
 * Jours civils "AAAA-MM-JJ" : arithmétique pure en UTC (ni fuseau ni heure
 * d'été), partagée par les métriques et la tournée des livraisons. Le jour
 * courant à Paris se calcule ailleurs (todayInParis).
 */

/** Période de jours, bornes incluses. */
export type DateRange = { from: string; to: string };

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIso(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Décale un jour de `n` jours (négatif vers le passé). "2026-09-01", -1 → "2026-08-31" */
export function addDays(day: string, n: number): string {
  const d = fromIso(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Nombre de jours d'une période, bornes incluses : du 1er au 30 septembre → 30. */
export function daysBetween(range: DateRange): number {
  return (
    Math.round(
      (fromIso(range.to).getTime() - fromIso(range.from).getTime()) /
        86_400_000,
    ) + 1
  );
}
