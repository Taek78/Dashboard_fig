import type { ReactNode } from "react";
import Form from "next/form";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDateFr } from "@/lib/format";

/*
 * Formulaire de période (serveur, GET via next/form), partagé par le tableau de
 * bord et les métriques : période prédéfinie OU plage libre « Du / Au », tout
 * passe par l'URL (partageable, sans JavaScript). `hiddenFields` conserve les
 * autres paramètres de la page (mode TVA…) ; `children` insère des champs
 * propres à la page avant le bouton (la comparaison des métriques).
 */
export function PeriodForm({
  action,
  period,
  customRange,
  range,
  hiddenFields = {},
  children,
}: {
  action: string;
  period: MetricPeriod;
  customRange: DateRange | null;
  range: DateRange;
  hiddenFields?: Record<string, string>;
  children?: ReactNode;
}) {
  return (
    <Form
      action={action}
      aria-label="Choix de la période"
      className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-end"
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
      {/* Du / Au côte à côte quand la page est étroite ; @2xl/main:contents les rend au parent flex. */}
      <div className="grid grid-cols-2 gap-3 @2xl/main:contents">
        <div className="grid gap-1.5">
          <Label htmlFor="du">Du</Label>
          <Input
            key={customRange?.from ?? ""}
            id="du"
            name="du"
            type="date"
            defaultValue={customRange?.from ?? ""}
            className="dark:scheme-dark"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="au">Au</Label>
          <Input
            key={customRange?.to ?? ""}
            id="au"
            name="au"
            type="date"
            defaultValue={customRange?.to ?? ""}
            className="dark:scheme-dark"
          />
        </div>
      </div>
      {children}
      <Button type="submit" className="w-full @2xl/main:w-auto">
        <CalendarRange />
        Afficher
      </Button>
      <p className="text-muted-foreground text-sm @2xl/main:ml-auto @2xl/main:self-center">
        Du {formatDateFr(range.from)} au {formatDateFr(range.to)}. Une plage «
        Du / Au » remplace la période.
      </p>
    </Form>
  );
}
