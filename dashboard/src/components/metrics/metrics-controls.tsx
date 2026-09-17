import { PeriodForm } from "@/components/metrics/period-form";
import { TaxModeSwitch } from "@/components/metrics/tax-mode-switch";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  COMPARISON_LABELS,
  COMPARISONS,
  type DateRange,
} from "@/domain/metrics/rules";
import type { MetricsQuery } from "@/domain/metrics/schemas";

/*
 * Contrôles de la page Métriques (serveur) : le formulaire de période partagé
 * (PeriodForm) complété par le choix de la référence de comparaison, et
 * l'interrupteur HT / TTC partagé (TaxModeSwitch) sur la même ligne. Tout
 * passe par l'URL ; le mode TVA est conservé d'une recherche à l'autre grâce
 * au champ caché.
 */
export function MetricsControls({
  query,
  range,
}: {
  query: MetricsQuery;
  range: DateRange;
}) {
  const baseParams = `${
    query.customRange
      ? `du=${query.customRange.from}&au=${query.customRange.to}`
      : `periode=${query.period}`
  }&comparaison=${query.comparison}`;

  return (
    <Card>
      <CardContent>
        <PeriodForm
          action="/metriques"
          period={query.period}
          custom={query.custom}
          range={range}
          hiddenFields={{ tva: query.tax }}
          tools={
            <TaxModeSwitch
              action="/metriques"
              tax={query.tax}
              baseParams={baseParams}
            />
          }
        >
          <div className="grid min-w-0 gap-1.5 @2xl/main:w-52">
            <Label htmlFor="comparaison">Comparer à</Label>
            <NativeSelect
              id="comparaison"
              name="comparaison"
              defaultValue={query.comparison}
              className="w-full"
            >
              {COMPARISONS.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {COMPARISON_LABELS[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </PeriodForm>
      </CardContent>
    </Card>
  );
}
