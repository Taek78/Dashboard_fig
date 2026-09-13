import Form from "next/form";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  COMPARISON_LABELS,
  COMPARISONS,
  METRIC_PERIOD_LABELS,
  METRIC_PERIODS,
  TAX_MODE_LABELS,
  TAX_MODES,
  type DateRange,
} from "@/domain/metrics/rules";
import type { MetricsQuery } from "@/domain/metrics/schemas";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Contrôles de la page Métriques (serveur, GET via next/form) : période
 * prédéfinie, plage libre, et interrupteur HT / TTC. Tout passe par l'URL :
 * partageable, sans JavaScript, et le mode TVA est conservé d'une recherche à
 * l'autre grâce au champ caché.
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
      <CardContent className="flex flex-col gap-4">
        <Form
          action="/metriques"
          aria-label="Période des métriques"
          className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
        >
          <input type="hidden" name="tva" value={query.tax} />
          <div className="grid gap-1.5 md:w-60">
            <Label htmlFor="periode">Période</Label>
            <NativeSelect
              id="periode"
              name="periode"
              defaultValue={query.customRange ? "" : query.period}
              className="w-full"
            >
              {query.customRange ? (
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
          {/* Du / Au côte à côte sur mobile ; md:contents les rend au parent flex. */}
          <div className="grid grid-cols-2 gap-3 md:contents">
            <div className="grid gap-1.5">
              <Label htmlFor="du">Du</Label>
              <Input
                key={query.customRange?.from ?? ""}
                id="du"
                name="du"
                type="date"
                defaultValue={query.customRange?.from ?? ""}
                className="dark:scheme-dark"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="au">Au</Label>
              <Input
                key={query.customRange?.to ?? ""}
                id="au"
                name="au"
                type="date"
                defaultValue={query.customRange?.to ?? ""}
                className="dark:scheme-dark"
              />
            </div>
          </div>
          <div className="grid gap-1.5 md:w-52">
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
          <Button type="submit" className="w-full md:w-auto">
            <CalendarRange />
            Afficher
          </Button>
          <p className="text-muted-foreground text-sm md:ml-auto md:self-center">
            Du {formatDateFr(range.from)} au {formatDateFr(range.to)}. Une plage
            « Du / Au » remplace la période.
          </p>
        </Form>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-sm font-medium">Montants affichés</span>
          <div
            role="group"
            aria-label="Mode de TVA"
            className="bg-muted/60 inline-flex items-center gap-0.5 rounded-full border p-0.5"
          >
            {TAX_MODES.map((mode) => {
              const active = mode === query.tax;
              return (
                <Link
                  key={mode}
                  href={`/metriques?${baseParams}&tva=${mode}`}
                  aria-pressed={active}
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-full px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TAX_MODE_LABELS[mode]}
                </Link>
              );
            })}
          </div>
          <span className="text-muted-foreground text-sm">
            TVA 5,5 % (taux réduit alimentaire), à confirmer avec le client.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
