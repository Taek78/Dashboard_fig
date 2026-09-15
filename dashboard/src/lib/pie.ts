/*
 * Géométrie d'un camembert plein en SVG : une part par valeur, proportionnelle,
 * dans l'ordre, en partant du haut et dans le sens des aiguilles d'une montre.
 * Pure et testée (test/lib/pie.test.ts) : le composant ne fait que dessiner.
 * Une valeur nulle ou négative ne dessine rien ; une seule valeur non nulle
 * dessine le disque entier (un arc de 360° ne se trace pas en une commande).
 */
export type PieSlicePath = { index: number; value: number; path: string };

const round = (n: number) => Math.round(n * 1000) / 1000;

function point(center: number, radius: number, angle: number): string {
  return `${round(center + radius * Math.cos(angle))} ${round(center + radius * Math.sin(angle))}`;
}

export function pieSlicePaths(
  values: readonly number[],
  radius: number,
  center = radius,
): PieSlicePath[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return [];
  const slices: PieSlicePath[] = [];
  let angle = -Math.PI / 2;
  values.forEach((raw, index) => {
    const value = Math.max(0, raw);
    if (value === 0) return;
    if (value === total) {
      const top = round(center - radius);
      const bottom = round(center + radius);
      slices.push({
        index,
        value,
        path: `M ${center} ${top} A ${radius} ${radius} 0 1 1 ${center} ${bottom} A ${radius} ${radius} 0 1 1 ${center} ${top} Z`,
      });
      return;
    }
    const sweep = (value / total) * Math.PI * 2;
    const end = angle + sweep;
    slices.push({
      index,
      value,
      path: `M ${center} ${center} L ${point(center, radius, angle)} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(center, radius, end)} Z`,
    });
    angle = end;
  });
  return slices;
}
