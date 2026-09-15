import type { StatusPoint } from "@/domain/metrics/rules";

/*
 * Répartition des commandes par statut : barres horizontales en HTML, rendues
 * par le serveur (aucun JavaScript), une couleur de thème par statut, le
 * nombre au bout de la barre. La plus grande valeur occupe toute la piste.
 * Les barres sont masquées aux lecteurs d'écran : la liste sr-only les double.
 */
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--destructive)",
];

export function StatusChart({ points }: { points: StatusPoint[] }) {
  const max = Math.max(0, ...points.map((p) => p.count));

  return (
    <div>
      <ul aria-hidden="true" className="flex flex-col gap-3 py-1">
        {points.map((p, i) => (
          <li
            key={p.status}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-xs @xl/main:text-sm"
          >
            <span className="text-muted-foreground truncate text-right">
              {p.label}
            </span>
            <span className="block h-5">
              <span
                className="block h-full rounded-r-md"
                style={{
                  width: max === 0 ? 0 : `${(p.count / max) * 100}%`,
                  minWidth: p.count > 0 ? 4 : 0,
                  background: COLORS[i % COLORS.length],
                }}
              />
            </span>
            <span className="text-foreground tabular-nums">{p.count}</span>
          </li>
        ))}
      </ul>
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.status}>
            {p.label} : {p.count}
          </li>
        ))}
      </ul>
    </div>
  );
}
