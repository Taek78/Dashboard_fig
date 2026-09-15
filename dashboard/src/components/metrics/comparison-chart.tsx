"use client";

import { useState, type PointerEvent } from "react";
import {
  CHART_METRIC_KINDS,
  CHART_METRIC_LABELS,
  CHART_METRICS,
  seriesValue,
  type Bucket,
  type ChartMetric,
  type ComparisonPoint,
} from "@/domain/metrics/rules";
import { areaPath, monotonePath, niceTicks } from "@/lib/chart";
import { formatDateFr, formatEuros } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Graphe d'évolution de la période, comparée à sa référence (N-1 ou période
 * précédente). Un sélecteur choisit la mesure tracée : chiffre d'affaires,
 * commandes, panier moyen, annulations, acheteurs. Le choix est un état local
 * (aucun rechargement : toutes les mesures sont déjà dans `points`). Les
 * montants arrivent déjà convertis dans le mode HT/TTC.
 *
 * SVG maison (géométrie pure de src/lib/chart.ts), sans bibliothèque : le
 * graphe est dans le HTML du serveur (aucun squelette) et pèse quelques Ko au
 * lieu d'une centaine. Le tracé s'étire à la taille du cadre (viewBox
 * 1000 × 1000 non proportionnel ; vector-effect garde l'épaisseur des traits).
 * Graduations, libellés, points et infobulle sont en HTML placé en
 * pourcentage : jamais déformés. Survol ou toucher : la période la plus proche
 * du pointeur s'affiche dans l'infobulle.
 * Densité selon la LARGEUR DE LA ZONE DE CONTENU (@container/main), pas de la
 * fenêtre : libellés courts et 4 repères sous @xl, 5 libellés complets jusqu'à
 * @4xl, 8 au-delà ; points masqués en étroit au-delà de 14 valeurs.
 * Le graphe est aria-hidden et ne prend jamais le focus : un tableau sr-only
 * le double pour les lecteurs d'écran.
 */
const VIEW = 1000;

function bucketLabel(key: string, bucket: Bucket): string {
  if (bucket === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${key}T00:00:00.000Z`));
  }
  if (bucket === "week") return `sem. ${formatDateFr(key)}`;
  return formatDateFr(key);
}

const shortDay = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Libellé court pour un graphe étroit : « 8 sept. », « sept. 26 ». */
function bucketShortLabel(key: string, bucket: Bucket): string {
  if (bucket === "month") return bucketLabel(key, bucket);
  return shortDay.format(new Date(`${key}T00:00:00.000Z`));
}

const compactNumber = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

/** Graduation de l'axe : « 1,2 k€ » ou « 850 € » pour un montant, entier sinon. */
function axisLabel(value: number, kind: "money" | "count"): string {
  if (kind === "count") return String(value);
  return value >= 1000
    ? `${compactNumber.format(value / 1000)} k€`
    : `${compactNumber.format(value)} €`;
}

function formatValue(cents: number, kind: "money" | "count"): string {
  return kind === "money" ? formatEuros(cents) : String(cents);
}

/** Libellé d'axe au bord du graphe : aligné vers l'intérieur, jamais hors du cadre. */
function edgeAlign(x: number): string {
  if (x < 0.08) return "translate-x-0";
  if (x > 0.92) return "-translate-x-full";
  return "-translate-x-1/2";
}

type Row = {
  key: string;
  label: string;
  /** Libellé d'axe court, en largeur étroite. */
  shortLabel: string;
  /** Valeurs tracées (euros ou compte). */
  current: number;
  previous: number;
  /** Valeurs brutes (centimes ou compte) pour le tableau et l'infobulle. */
  currentRaw: number;
  previousRaw: number;
};

function ChartTooltip({
  row,
  x,
  kind,
  referenceLabel,
}: {
  row: Row;
  /** Position du point, de 0 (gauche) à 1 (droite). */
  x: number;
  kind: "money" | "count";
  referenceLabel: string;
}) {
  const delta =
    row.previousRaw === 0
      ? null
      : Math.round(
          ((row.currentRaw - row.previousRaw) / row.previousRaw) * 100,
        );
  return (
    <div
      className="bg-popover/95 text-popover-foreground ring-foreground/10 pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl px-3 py-2 text-xs shadow-lg ring-1 backdrop-blur"
      style={
        x <= 0.5
          ? { left: `calc(${x * 100}% + 12px)` }
          : { right: `calc(${(1 - x) * 100}% + 12px)` }
      }
    >
      <p className="text-muted-foreground mb-1 font-medium">{row.label}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <span className="bg-gradient-brand size-2 rounded-full" />
          Période
        </span>
        <span className="font-semibold tabular-nums">
          {formatValue(row.currentRaw, kind)}
        </span>
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/60 size-2 rounded-full" />
          {referenceLabel}
        </span>
        <span className="tabular-nums">
          {formatValue(row.previousRaw, kind)}
        </span>
      </p>
      {delta !== null ? (
        <p
          className={cn(
            "mt-1 text-right font-semibold tabular-nums",
            delta > 0 && "text-success",
            delta < 0 && "text-destructive",
            delta === 0 && "text-info",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta} %
        </p>
      ) : null}
    </div>
  );
}

export function ComparisonChart({
  points,
  bucket,
  taxLabel,
  referenceLabel,
}: {
  points: ComparisonPoint[];
  bucket: Bucket;
  taxLabel: string;
  referenceLabel: string;
}) {
  const [metric, setMetric] = useState<ChartMetric>("revenue");
  const [active, setActive] = useState<number | null>(null);
  const kind = CHART_METRIC_KINDS[metric];
  const scale = kind === "money" ? 100 : 1;
  const rows: Row[] = points.map((p) => {
    const currentRaw = seriesValue(p.current, metric);
    const previousRaw = seriesValue(p.previous, metric);
    return {
      key: p.key,
      label: bucketLabel(p.key, bucket),
      shortLabel: bucketShortLabel(p.key, bucket),
      current: currentRaw / scale,
      previous: previousRaw / scale,
      currentRaw,
      previousRaw,
    };
  });
  const count = rows.length;
  const ticks = niceTicks(
    Math.max(0, ...rows.flatMap((r) => [r.current, r.previous])),
    4,
    kind === "count",
  );
  const top = ticks.at(-1)!;
  const xAt = (i: number) => (count <= 1 ? 0.5 : i / (count - 1));
  const yAt = (value: number) => 1 - value / top;
  const trace = (pick: (r: Row) => number) =>
    rows.map((r, i) => ({ x: xAt(i) * VIEW, y: yAt(pick(r)) * VIEW }));
  const current = trace((r) => r.current);
  const previous = trace((r) => r.previous);
  const hasPrevious = rows.some((r) => r.previousRaw > 0);
  const metricLabel =
    kind === "money"
      ? `${CHART_METRIC_LABELS[metric]} ${taxLabel}`
      : CHART_METRIC_LABELS[metric];
  // Libellés d'axe visibles par palier de largeur : 4 courts, 5 puis 8 complets.
  const steps = [4, 5, 8].map((n) => Math.max(1, Math.ceil(count / n)));
  const activeRow = active === null ? null : rows[active];

  function pick(event: PointerEvent<HTMLDivElement>) {
    if (count === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(
      Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between">
        <div
          role="group"
          aria-label="Mesure affichée"
          className="bg-muted/60 grid grid-cols-2 gap-1 rounded-2xl border p-1 @xl/main:grid-cols-3 @3xl/main:flex @3xl/main:gap-0.5 @3xl/main:rounded-full @3xl/main:p-0.5"
        >
          {CHART_METRICS.map((m) => {
            const selected = m === metric;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => setMetric(m)}
                className={cn(
                  "focus-visible:ring-ring/50 shrink-0 rounded-full px-3 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 @3xl/main:py-1.5",
                  m === "revenue" && "col-span-2 @xl/main:col-span-1",
                  selected
                    ? "bg-gradient-brand text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {CHART_METRIC_LABELS[m]}
              </button>
            );
          })}
        </div>
        <ul className="text-muted-foreground flex items-center gap-4 text-xs">
          <li className="flex items-center gap-1.5">
            <span className="bg-gradient-brand size-2.5 rounded-full" />
            Période choisie
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/60 size-2.5 rounded-full" />
            {referenceLabel}
          </li>
        </ul>
      </div>

      <div
        aria-hidden="true"
        className="grid h-80 w-full grid-cols-[3.25rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_1.75rem] pt-3 @xl/main:h-96 @xl/main:grid-cols-[3.75rem_minmax(0,1fr)]"
      >
        <div className="relative">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap tabular-nums @xl/main:text-xs"
              style={{ top: `${yAt(tick) * 100}%` }}
            >
              {axisLabel(tick, kind)}
            </span>
          ))}
        </div>

        <div
          data-slot="evolution-chart"
          className="relative touch-pan-y"
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
        >
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="evolution-fill"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={VIEW}
              >
                <stop
                  offset="0%"
                  stopColor="var(--brand-from)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--brand-to)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient
                id="evolution-stroke"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2={VIEW}
                y2="0"
              >
                <stop offset="0%" stopColor="var(--brand-from)" />
                <stop offset="100%" stopColor="var(--brand-to)" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={VIEW}
                y1={yAt(tick) * VIEW}
                y2={yAt(tick) * VIEW}
                stroke="var(--border)"
                strokeDasharray="3 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={areaPath(current, VIEW)} fill="url(#evolution-fill)" />
            <path
              d={monotonePath(previous)}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.75}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={monotonePath(current)}
              fill="none"
              stroke="url(#evolution-stroke)"
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {count <= 31
            ? rows.map((r, i) => (
                <span
                  key={r.key}
                  className={cn(
                    "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    count > 14 && "hidden @xl/main:block",
                  )}
                  style={{
                    left: `${xAt(i) * 100}%`,
                    top: `${yAt(r.current) * 100}%`,
                    background: "var(--brand-from)",
                  }}
                />
              ))
            : null}

          {activeRow && active !== null ? (
            <>
              <span
                className="bg-border absolute inset-y-0 w-px"
                style={{ left: `${xAt(active) * 100}%` }}
              />
              <span
                className="ring-card absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{
                  left: `${xAt(active) * 100}%`,
                  top: `${yAt(activeRow.previous) * 100}%`,
                  background: "var(--muted-foreground)",
                }}
              />
              <span
                className="ring-card absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                style={{
                  left: `${xAt(active) * 100}%`,
                  top: `${yAt(activeRow.current) * 100}%`,
                  background: "var(--brand-from)",
                }}
              />
              <ChartTooltip
                row={activeRow}
                x={xAt(active)}
                kind={kind}
                referenceLabel={referenceLabel}
              />
            </>
          ) : null}
        </div>

        <div />
        <div className="relative">
          {rows.map((r, i) => {
            const [narrow, medium, wide] = steps.map((s) => i % s === 0);
            if (!narrow && !medium && !wide) return null;
            return (
              <span
                key={r.key}
                className={cn(
                  "text-muted-foreground absolute top-1.5 text-[11px] whitespace-nowrap @xl/main:text-xs",
                  edgeAlign(xAt(i)),
                  narrow ? "block" : "hidden",
                  medium ? "@xl/main:block" : "@xl/main:hidden",
                  wide ? "@4xl/main:block" : "@4xl/main:hidden",
                )}
                style={{ left: `${xAt(i) * 100}%` }}
              >
                <span className="@xl/main:hidden">{r.shortLabel}</span>
                <span className="hidden @xl/main:inline">{r.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      <p className="text-muted-foreground text-xs @3xl/main:hidden">
        Touchez le graphe pour lire la valeur d&apos;une période.
      </p>

      {!hasPrevious ? (
        <p className="text-muted-foreground text-xs">
          Aucune donnée sur la période de référence (
          {referenceLabel.toLowerCase()}) : la ligne de comparaison reste à
          zéro.
        </p>
      ) : null}

      {/* Enveloppe sr-only : un <table> garde sa largeur même masqué et ferait défiler la page sur mobile. */}
      <div className="sr-only">
        <table>
          <caption>
            {metricLabel} par période, comparé à :{" "}
            {referenceLabel.toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">{metricLabel}</th>
              <th scope="col">{metricLabel} (référence)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{formatValue(r.currentRaw, kind)}</td>
                <td>{formatValue(r.previousRaw, kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
