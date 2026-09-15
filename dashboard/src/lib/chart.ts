/*
 * Géométrie PURE des graphiques de la page Métriques, dessinés en SVG maison
 * (sans bibliothèque) : graduations « rondes » de l'axe vertical et tracés
 * lissés. Les coordonnées sont celles d'un viewBox (0 à `size`) que le
 * composant étire à la taille de son cadre. Testé dans test/lib/chart.test.ts.
 */
export type ChartPoint = { x: number; y: number };

const tidy = (value: number) => Number(value.toPrecision(12));

/**
 * Graduations régulières de 0 jusqu'à au moins `max`, au pas « rond » (1, 2,
 * 2,5 ou 5 × 10ⁿ) le plus petit qui en donne au plus `count` au-dessus de 0.
 * `integer` : jamais de pas inférieur à 1 (des commandes, pas des euros).
 * Maximum nul ou négatif : [0, 1], un axe lisible sans données.
 */
export function niceTicks(max: number, count = 4, integer = false): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10]
    .map((m) => m * power)
    .find((candidate) => candidate >= raw - 1e-9)!;
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = Math.ceil(tidy(max / step)) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) =>
    tidy(i * step),
  );
}

const coord = (value: number) => tidy(Math.round(value * 10) / 10);

/**
 * Courbe lissée monotone (méthode de Fritsch-Carlson, comme « monotone » des
 * bibliothèques de graphes) : elle passe par chaque point sans jamais dépasser
 * les valeurs voisines, donc sans bosse trompeuse entre deux mesures.
 */
export function monotonePath(points: readonly ChartPoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  const first = points[0]!;
  if (n === 1) return `M${coord(first.x)},${coord(first.y)}`;

  const widths: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1]!.x - points[i]!.x;
    widths.push(h);
    slopes.push(h === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / h);
  }
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const [before, after] = [slopes[i - 1]!, slopes[i]!];
    if (before * after <= 0) return 0;
    const [h0, h1] = [widths[i - 1]!, widths[i]!];
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / before + (h1 + 2 * h0) / after);
  });

  let path = `M${coord(first.x)},${coord(first.y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [a, b] = [points[i]!, points[i + 1]!];
    const third = widths[i]! / 3;
    path +=
      `C${coord(a.x + third)},${coord(a.y + tangents[i]! * third)},` +
      `${coord(b.x - third)},${coord(b.y - tangents[i + 1]! * third)},` +
      `${coord(b.x)},${coord(b.y)}`;
  }
  return path;
}

/** Surface sous la courbe : le tracé, puis retour par la ligne de base `baseline`. */
export function areaPath(
  points: readonly ChartPoint[],
  baseline: number,
): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points.at(-1)!;
  return `${monotonePath(points)}L${coord(last.x)},${coord(baseline)}L${coord(first.x)},${coord(baseline)}Z`;
}
