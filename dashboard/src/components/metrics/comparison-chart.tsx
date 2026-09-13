"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bucket, ComparisonPoint } from "@/domain/metrics/rules";
import { formatDateFr, formatEuros } from "@/lib/format";

/*
 * Chiffre d'affaires de la période, en aire pleine, avec la même période un an
 * plus tôt (N-1) en ligne pointillée. Les montants arrivent déjà convertis dans
 * le mode HT/TTC choisi. Les libellés d'axe dépendent de la granularité
 * (jour, semaine, mois) calculée par bucketFor(). Un tableau sr-only double le
 * graphe pour les lecteurs d'écran.
 */
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

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

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
  const data = points.map((p) => ({
    ...p,
    label: bucketLabel(p.key, bucket),
    current: p.currentCents / 100,
    previous: p.previousCents / 100,
  }));
  const hasPrevious = points.some((p) => p.previousCents > 0);

  return (
    <div>
      <div className="h-64 w-full sm:h-80" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="ca-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-2)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-2)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v: number) => `${v} €`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                formatEuros(Math.round(Number(value) * 100)),
                name === "current"
                  ? `CA ${taxLabel}`
                  : `CA ${taxLabel} (${referenceLabel.toLowerCase()})`,
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "current" ? "Période choisie" : referenceLabel
              }
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              fill="url(#ca-fill)"
              dot={data.length <= 31}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!hasPrevious ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Aucune commande sur la période de référence (
          {referenceLabel.toLowerCase()}) : la ligne de comparaison reste à
          zéro.
        </p>
      ) : null}
      <table className="sr-only">
        <caption>
          Chiffre d&apos;affaires {taxLabel} par période, comparé à :{" "}
          {referenceLabel.toLowerCase()}
        </caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th scope="col">CA {taxLabel}</th>
            <th scope="col">CA {taxLabel} (référence)</th>
            <th scope="col">Commandes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td>{formatEuros(p.currentCents)}</td>
              <td>{formatEuros(p.previousCents)}</td>
              <td>{p.currentOrders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
