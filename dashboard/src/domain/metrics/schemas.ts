import { z } from "zod";
import {
  COMPARISONS,
  CUSTOM_PERIOD,
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
 * Entrées du tableau de bord et des métriques (lecture tolérante) :
 *   ?periode=ce-mois          période prédéfinie (défaut : ce mois-ci sur les
 *                             métriques, aujourd'hui sur le tableau de bord)
 *   ?periode=personnalisee    « Période personnalisée » : la zone de dates est
 *                             ouverte et ?du=AAAA-MM-JJ&au=… fait la période
 *                             (règle commune parsePeriodInput : une seule date
 *                             = ce jour-là, inversées = aucune, l'écran dit
 *                             alors pourquoi et la période prédéfinie reste
 *                             affichée). Des dates dans l'URL ouvrent aussi la
 *                             zone quel que soit ?periode= (anciens liens,
 *                             raccourcis) : une erreur doit se voir.
 *   ?tva=ttc|ht               mode d'affichage des montants (défaut : HT)
 *   ?comparaison=n-1|precedente  référence des variations (défaut : N-1),
 *                             métriques seulement
 */
const PERIOD_CHOICES = [...METRIC_PERIODS, CUSTOM_PERIOD] as const;

const periodQuerySchema = z.object({
  periode: z.enum(PERIOD_CHOICES).optional().catch(undefined),
  du: z.iso.date().optional().catch(undefined),
  au: z.iso.date().optional().catch(undefined),
  tva: z.enum(TAX_MODES).optional().catch(undefined),
});
type PeriodFields = z.infer<typeof periodQuerySchema>;

const metricsQuerySchema = periodQuerySchema.extend({
  comparaison: z.enum(COMPARISONS).optional().catch(undefined),
});

/** Ce que les deux pages lisent de la période et de la TVA. */
export type PeriodQuery = {
  /** La période prédéfinie de l'URL (ou le défaut), appliquée tant qu'aucune plage n'est effective. */
  period: MetricPeriod;
  /** La zone de dates est ouverte : « Période personnalisée » choisie, ou des dates dans l'URL. */
  customPeriod: boolean;
  /** Plage effective des dates saisies, ou null (période prédéfinie). */
  customRange: DateRange | null;
  /** La saisie « du / au » telle quelle, pour les champs et l'erreur. */
  custom: DateRangeInput;
  tax: TaxMode;
};

export type MetricsQuery = PeriodQuery & { comparison: Comparison };

function readPeriod(
  { periode, du, au, tva }: PeriodFields,
  defaultPeriod: MetricPeriod,
): PeriodQuery {
  const custom = parsePeriodInput({ du, au });
  return {
    period:
      periode === undefined || periode === CUSTOM_PERIOD
        ? defaultPeriod
        : periode,
    customPeriod:
      periode === CUSTOM_PERIOD ||
      custom.from !== undefined ||
      custom.to !== undefined,
    customRange: custom.range,
    custom,
    tax: tva ?? DEFAULT_TAX_MODE,
  };
}

export function parseMetricsQuery(
  raw: Record<string, string | string[] | undefined>,
): MetricsQuery {
  const { comparaison, ...fields } = metricsQuerySchema.parse(raw);
  return {
    ...readPeriod(fields, DEFAULT_PERIOD),
    comparison: comparaison ?? "n-1",
  };
}

/** Le tableau de bord : même lecture, défaut « aujourd'hui ». */
export function parsePeriodQuery(
  raw: Record<string, string | string[] | undefined>,
  defaultPeriod: MetricPeriod = "aujourdhui",
): PeriodQuery {
  return readPeriod(periodQuerySchema.parse(raw), defaultPeriod);
}

/**
 * Les paramètres de période à rejouer dans un autre lien de la page (HT /
 * TTC) : `periode=<prédéfinie>`, ou `periode=personnalisee` avec les dates
 * telles qu'elles ont été saisies (même inversées : l'erreur reste visible).
 */
export function periodParams(
  query: Pick<PeriodQuery, "period" | "customPeriod" | "custom">,
): string {
  if (!query.customPeriod) return `periode=${query.period}`;
  const params = [`periode=${CUSTOM_PERIOD}`];
  if (query.custom.from) params.push(`du=${query.custom.from}`);
  if (query.custom.to) params.push(`au=${query.custom.to}`);
  return params.join("&");
}
