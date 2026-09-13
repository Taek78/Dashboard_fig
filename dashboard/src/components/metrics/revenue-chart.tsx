"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayPoint } from "@/domain/metrics/rules";
import { formatDateFr, formatEuros } from "@/lib/format";

/*
 * Chiffre d'affaires par jour (client : recharts a besoin du DOM). Reçoit des
 * points déjà calculés par revenueByDay(). Couleurs par tokens (--chart-1) pour
 * suivre le thème et le mode sombre. Un tableau sr-only double le graphique pour
 * les lecteurs d'écran.
 */
export function RevenueChart({ points }: { points: DayPoint[] }) {
  const data = points.map((p) => ({
    ...p,
    label: formatDateFr(p.date),
    euros: p.revenueCents / 100,
  }));

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
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
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              formatter={(value) => [formatEuros(Number(value) * 100), "CA"]}
            />
            <Bar
              dataKey="euros"
              fill="var(--chart-1)"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Chiffre d&apos;affaires par jour de livraison</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Commandes</th>
            <th scope="col">Chiffre d&apos;affaires</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.date}>
              <td>{p.label}</td>
              <td>{p.orderCount}</td>
              <td>{formatEuros(p.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
