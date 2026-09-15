"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_METRIC_KINDS,
  CHART_METRIC_LABELS,
  CHART_METRICS,
  seriesValue,
  type Bucket,
  type ChartMetric,
  type ComparisonPoint,
} from "@/domain/metrics/rules";
import { formatDateFr, formatEuros } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Graphe d'évolution de la période, comparée à sa référence (N-1 ou période
 * précédente). Un sélecteur choisit la mesure tracée : chiffre d'affaires,
 * commandes, panier moyen, annulations, acheteurs. Le choix est un état local
 * (aucun rechargement : toutes les mesures sont déjà dans `points`). Les
 * montants arrivent déjà convertis dans le mode HT/TTC. Les libellés d'axe
 * dépendent de la granularité (jour, semaine, mois). Un tableau sr-only double
 * le graphe pour les lecteurs d'écran : le graphe est aria-hidden, et
 * accessibilityLayer={false} l'empêche de prendre le focus (Chrome refuse un
 * élément focalisé sous aria-hidden).
 * Mode compact décidé par la LARGEUR DU GRAPHE (onResize), pas par celle de la
 * fenêtre : sur tablette, sidebar ouverte, le graphe est aussi étroit que sur un
 * téléphone. Compact = libellés d'axe courts, traits plus épais, points masqués
 * au-delà de 14 valeurs. Sélecteur en grille tant que la page est étroite.
 */
const COMPACT_WIDTH = 560;

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
    : `${value} €`;
}

function formatValue(cents: number, kind: "money" | "count"): string {
  return kind === "money" ? formatEuros(cents) : String(cents);
}

type Row = {
  key: string;
  label: string;
  /** Libellé d'axe court, en mode compact. */
  shortLabel: string;
  current: number;
  previous: number;
  /** Valeurs brutes (centimes ou compte) pour le tableau et l'infobulle. */
  currentRaw: number;
  previousRaw: number;
};

function ChartTooltip({
  active,
  payload,
  kind,
  referenceLabel,
}: {
  active?: boolean;
  payload?: readonly { payload: Row }[];
  kind: "money" | "count";
  referenceLabel: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const delta =
    row.previousRaw === 0
      ? null
      : Math.round(
          ((row.currentRaw - row.previousRaw) / row.previousRaw) * 100,
        );
  return (
    <div className="bg-popover/95 text-popover-foreground ring-foreground/10 min-w-44 rounded-xl px-3 py-2 text-xs shadow-lg ring-1 backdrop-blur">
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
  // Première peinture en compact (le cas le plus contraint), corrigé dès la
  // première mesure ; un setState à valeur identique ne rend pas deux fois.
  const [compact, setCompact] = useState(true);
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
  const hasPrevious = rows.some((r) => r.previousRaw > 0);
  const metricLabel =
    kind === "money"
      ? `${CHART_METRIC_LABELS[metric]} ${taxLabel}`
      : CHART_METRIC_LABELS[metric];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center @3xl/main:justify-between">
        <div
          role="group"
          aria-label="Mesure affichée"
          className="bg-muted/60 grid grid-cols-2 gap-1 rounded-2xl border p-1 @xl/main:grid-cols-3 @3xl/main:flex @3xl/main:gap-0.5 @3xl/main:rounded-full @3xl/main:p-0.5"
        >
          {CHART_METRICS.map((m) => {
            const active = m === metric;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMetric(m)}
                className={cn(
                  "focus-visible:ring-ring/50 shrink-0 rounded-full px-3 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 @3xl/main:py-1.5",
                  m === "revenue" && "col-span-2 @xl/main:col-span-1",
                  active
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

      <div className="h-80 w-full @xl/main:h-96" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          onResize={(width) => setCompact(width < COMPACT_WIDTH)}
        >
          <ComposedChart
            data={rows}
            accessibilityLayer={false}
            margin={
              compact
                ? { top: 16, right: 6, left: -8, bottom: 4 }
                : { top: 12, right: 12, left: 0, bottom: 0 }
            }
          >
            <defs>
              <linearGradient id="evolution-fill" x1="0" y1="0" x2="0" y2="1">
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
              <linearGradient id="evolution-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--brand-from)" />
                <stop offset="100%" stopColor="var(--brand-to)" />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 6"
            />
            <XAxis
              dataKey={compact ? "shortLabel" : "label"}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={compact ? 32 : 24}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: compact ? 11 : 12,
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={compact ? 56 : 60}
              allowDecimals={kind === "money"}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: compact ? 11 : 12,
              }}
              tickFormatter={(v: number) => axisLabel(v, kind)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={
                <ChartTooltip kind={kind} referenceLabel={referenceLabel} />
              }
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="url(#evolution-stroke)"
              strokeWidth={compact ? 3 : 2.5}
              fill="url(#evolution-fill)"
              dot={
                rows.length <= (compact ? 14 : 31)
                  ? { r: 3, strokeWidth: 0, fill: "var(--brand-from)" }
                  : false
              }
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--muted-foreground)"
              strokeWidth={compact ? 2 : 1.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--muted-foreground)",
                strokeWidth: 0,
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
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
