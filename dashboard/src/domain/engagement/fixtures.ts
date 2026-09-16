import type { EngagementPoint } from "@/domain/engagement/types";

/*
 * Statistiques d'usage factices, de janvier 2024 à septembre 2026, construites
 * par une formule DÉTERMINISTE (aucun aléa) : croissance douce, saisonnalité
 * estivale, note qui s'améliore. Assez de mois pour que les comparaisons N-1,
 * N-2 et N-3 aient quelque chose à montrer.
 */
const FIRST = { year: 2024, month: 1 };
const LAST = { year: 2026, month: 9 };

function build(): EngagementPoint[] {
  const points: EngagementPoint[] = [];
  let index = 0;
  for (let y = FIRST.year; y <= LAST.year; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      if (y === LAST.year && m > LAST.month) break;
      const seasonal = m >= 5 && m <= 8 ? 1.25 : m === 12 ? 0.8 : 1;
      const downloads = Math.round((160 + index * 9) * seasonal);
      const signups = Math.round(downloads * (0.3 + (index % 5) * 0.01));
      const ratingCount = 12 + ((index * 3) % 9);
      const rating = Math.min(
        4.9,
        Math.round((3.9 + index * 0.025) * 100) / 100,
      );
      points.push({
        month: `${y}-${String(m).padStart(2, "0")}`,
        downloads,
        signups,
        rating,
        ratingCount,
      });
      index += 1;
    }
  }
  return points;
}

export const engagementFixtures: readonly EngagementPoint[] = build();
