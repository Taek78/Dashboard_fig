import type { ReactNode } from "react";
import Form from "next/form";
import { CalendarRange } from "lucide-react";
import { DateRangeFields } from "@/components/date-range-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  METRIC_PERIOD_LABELS,
  METRIC_PERIODS,
  type DateRange,
  type MetricPeriod,
} from "@/domain/metrics/rules";
import type { DateRangeInput } from "@/lib/days";
import { endSentence, formatDateFr } from "@/lib/format";

/*
 * Formulaire de période (serveur, GET via next/form), partagé par le tableau de
 * bord et les métriques : période prédéfinie OU plage libre « Du / Au » en un
 * seul filtre (DateRangeFields : une date = ce jour-là, dates inversées =
 * erreur rouge et la période prédéfinie s'applique), tout passe par l'URL
 * (partageable, sans JavaScript). `hiddenFields` conserve les autres
 * paramètres de la page (mode TVA…) ; `children` insère des champs propres à
 * la page avant le bouton (la comparaison des métriques). La clé sur les
 * champs de dates les remonte quand l'URL change (defaultValue relu).
 */
export function PeriodForm({
  action,
  period,
  custom,
  range,
  hiddenFields = {},
  children,
}: {
  action: string;
  period: MetricPeriod;
  /** La saisie « du / au » de l'URL ; `custom.range` = plage libre effective. */
  custom: DateRangeInput;
  range: DateRange;
  hiddenFields?: Record<string, string>;
  children?: ReactNode;
}) {
  const customRange = custom.range;
  return (
    <Form
      action={action}
      aria-label="Choix de la période"
      className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-start"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-1.5 @2xl/main:w-60">
        <Label htmlFor="periode">Période</Label>
        <NativeSelect
          id="periode"
          name="periode"
          defaultValue={customRange ? "" : period}
          className="w-full"
        >
          {customRange ? (
            <NativeSelectOption value="">
              Plage personnalisée
            </NativeSelectOption>
          ) : null}
          {METRIC_PERIODS.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {METRIC_PERIOD_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <DateRangeFields
        key={`${custom.from ?? ""}-${custom.to ?? ""}`}
        legend="Plage libre"
        fromLabel="Du"
        toLabel="Au"
        idPrefix="periode"
        period={custom}
        help="Une plage « Du / Au » remplace la période. Une seule date : ce jour-là."
        className="@2xl/main:w-80"
      />
      {children}
      <Button type="submit" className="w-full @2xl/main:mt-6 @2xl/main:w-auto">
        <CalendarRange />
        Afficher
      </Button>
      <p className="text-muted-foreground text-sm @2xl/main:mt-8 @2xl/main:ml-auto">
        {endSentence(
          `Du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`,
        )}
      </p>
    </Form>
  );
}
