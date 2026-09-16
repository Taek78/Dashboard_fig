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
import { parsePeriodInput } from "@/domain/orders/schemas";
import type { DateRangeInput } from "@/lib/days";

/*
 * Entrées de la page Métriques (lecture tolérante) :
 *   ?periode=ce-mois          période prédéfinie (défaut : ce mois-ci)
 *   ?du=AAAA-MM-JJ&au=…       plage libre, prioritaire quand elle est
 *                             effective (règle commune parsePeriodInput : une
 *                             seule date = ce jour-là, inversées = aucune,
 *                             l'écran dit alors pourquoi)
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
  .transform(({ periode, du, au, tva, comparaison }) => {
    const custom = parsePeriodInput({ du, au });
    return {
      period: periode ?? DEFAULT_PERIOD,
      customRange: custom.range,
      custom,
      tax: tva ?? DEFAULT_TAX_MODE,
      comparison: comparaison ?? "n-1",
    };
  });

export type MetricsQuery = {
  period: MetricPeriod;
  /** Plage libre effective, ou null (période prédéfinie). */
  customRange: DateRange | null;
  /** La saisie « du / au » telle quelle, pour les champs et l'erreur. */
  custom: DateRangeInput;
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
  custom: DateRangeInput;
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
  const custom = parsePeriodInput({ du, au });
  return {
    period: periode ?? defaultPeriod,
    customRange: custom.range,
    custom,
    tax: tva ?? DEFAULT_TAX_MODE,
  };
}
