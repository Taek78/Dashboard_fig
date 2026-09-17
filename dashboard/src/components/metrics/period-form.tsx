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
import { formatPeriodFr } from "@/lib/format";

/*
 * Formulaire de période (serveur, GET via next/form), partagé par le tableau de
 * bord et les métriques. Deux lignes : les listes (période prédéfinie,
 * `children` propres à la page comme la comparaison des métriques) avec, à
 * droite, les `tools` de la page (interrupteur HT / TTC) ; puis la zone de la
 * plage libre « Du / Au » sur sa propre surface (DateRangeFields : une date =
 * ce jour-là, dates inversées = erreur rouge et la période prédéfinie
 * s'applique), avec le bouton « Afficher » et, en légende, la période
 * effectivement affichée. Tout passe par l'URL (partageable, sans
 * JavaScript) ; `hiddenFields` conserve les autres paramètres de la page
 * (mode TVA…). La clé sur la zone de dates la remonte quand l'URL change
 * (defaultValue relu).
 */
export function PeriodForm({
  action,
  period,
  custom,
  range,
  hiddenFields = {},
  children,
  tools,
}: {
  action: string;
  period: MetricPeriod;
  /** La saisie « du / au » de l'URL ; `custom.range` = plage libre effective. */
  custom: DateRangeInput;
  range: DateRange;
  hiddenFields?: Record<string, string>;
  /** Champs propres à la page, sur la ligne des listes. */
  children?: ReactNode;
  /** Commandes de la page (liens), à droite de la ligne des listes. */
  tools?: ReactNode;
}) {
  const customRange = custom.range;
  return (
    <Form
      action={action}
      aria-label="Choix de la période"
      className="flex flex-col gap-4"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-end">
        <div className="grid min-w-0 gap-1.5 @2xl/main:w-56">
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
        {children}
        {tools ? (
          <div className="min-w-0 @2xl/main:ml-auto @2xl/main:pb-0.5">
            {tools}
          </div>
        ) : null}
      </div>
      <DateRangeFields
        key={`${custom.from ?? ""}-${custom.to ?? ""}`}
        variant="zone"
        legend="Plage libre"
        fromLabel="Du"
        toLabel="Au"
        idPrefix="periode"
        period={custom}
        action={
          <Button type="submit" className="w-full @xl/main:w-auto">
            <CalendarRange />
            Afficher
          </Button>
        }
        caption={`Période affichée : ${formatPeriodFr(range.from, range.to)}.`}
      />
    </Form>
  );
}
