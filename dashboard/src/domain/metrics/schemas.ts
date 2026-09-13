import { z } from "zod";
import {
  COMPARISONS,
  DEFAULT_PERIOD,
  DEFAULT_TAX_MODE,
  METRIC_PERIODS,
  TAX_MODES,
  type Comparison,
  type DateRange,
  type MetricPeriod,
  type TaxMode,
} from "@/domain/metrics/rules";

/*
 * Entrées de la page Métriques (lecture tolérante) :
 *   ?periode=ce-mois          période prédéfinie (défaut : ce mois-ci)
 *   ?du=AAAA-MM-JJ&au=…       plage libre, prioritaire si les deux bornes sont
 *                             valides et ordonnées
 *   ?tva=ttc|ht               mode d'affichage des montants (défaut : TTC)
 *   ?comparaison=n-1|precedente  référence des variations (défaut : N-1)
 */
const metricsQuerySchema = z
  .object({
    periode: z.enum(METRIC_PERIODS).optional().catch(undefined),
    du: z.iso.date().optional().catch(undefined),
    au: z.iso.date().optional().catch(undefined),
    tva: z.enum(TAX_MODES).optional().catch(undefined),
    comparaison: z.enum(COMPARISONS).optional().catch(undefined),
  })
  .transform(({ periode, du, au, tva, comparaison }) => ({
    period: periode ?? DEFAULT_PERIOD,
    customRange: du && au && du <= au ? { from: du, to: au } : null,
    tax: tva ?? DEFAULT_TAX_MODE,
    comparison: comparaison ?? "n-1",
  }));

export type MetricsQuery = {
  period: MetricPeriod;
  customRange: DateRange | null;
  tax: TaxMode;
  comparison: Comparison;
};

export function parseMetricsQuery(
  raw: Record<string, string | string[] | undefined>,
): MetricsQuery {
  return metricsQuerySchema.parse(raw);
}

/*
 * Sous-ensemble « période et TVA » (?periode=, ?du=&au=, ?tva=) pour les pages
 * sans comparaison : le tableau de bord, dont le défaut est aujourd'hui en HT.
 */
export type PeriodQuery = {
  period: MetricPeriod;
  customRange: DateRange | null;
  tax: TaxMode;
};

const periodQuerySchema = z.object({
  periode: z.enum(METRIC_PERIODS).optional().catch(undefined),
  du: z.iso.date().optional().catch(undefined),
  au: z.iso.date().optional().catch(undefined),
  tva: z.enum(TAX_MODES).optional().catch(undefined),
});

export function parsePeriodQuery(
  raw: Record<string, string | string[] | undefined>,
  defaultPeriod: MetricPeriod = "aujourdhui",
): PeriodQuery {
  const { periode, du, au, tva } = periodQuerySchema.parse(raw);
  return {
    period: periode ?? defaultPeriod,
    customRange: du && au && du <= au ? { from: du, to: au } : null,
    tax: tva ?? DEFAULT_TAX_MODE,
  };
}
