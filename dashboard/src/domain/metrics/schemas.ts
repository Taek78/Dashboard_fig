import { z } from "zod";
import { METRIC_PERIODS, type MetricPeriod } from "@/domain/metrics/rules";

/* ?periode=7|30|tout de la page Métriques ; invalide ou absent → 30 jours. */
const periodSchema = z
  .object({ periode: z.enum(METRIC_PERIODS).optional().catch(undefined) })
  .transform(({ periode }) => periode ?? "30");

export function parseMetricPeriod(
  raw: Record<string, string | string[] | undefined>,
): MetricPeriod {
  return periodSchema.parse(raw);
}
