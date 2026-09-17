import type { ReactNode } from "react";
import Form from "next/form";
import { CalendarRange } from "lucide-react";
import { DateRangeFields } from "@/components/date-range-fields";
import { PeriodChooser } from "@/components/metrics/period-chooser";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_PERIOD,
  type DateRange,
  type MetricPeriod,
} from "@/domain/metrics/rules";
import type { DateRangeInput } from "@/lib/days";
import { formatPeriodFr } from "@/lib/format";

/*
 * Formulaire de période (serveur, GET via next/form), partagé par le tableau de
 * bord et les métriques. Trois lignes : les listes (« Période », dont le
 * dernier choix est « Période personnalisée », puis les `children` propres à
 * la page comme la comparaison des métriques) avec, à droite, les `tools` de
 * la page (interrupteur HT / TTC) ; la zone de dates « Du / Au » sur sa propre
 * surface, présente SEULEMENT pour « Période personnalisée » (PeriodChooser la
 * monte dès le choix ; DateRangeFields : une date = ce jour-là, dates
 * inversées = erreur rouge et la période prédéfinie reste affichée) ; enfin le
 * bouton « Afficher » et, en légende, la période effectivement affichée. Tout
 * passe par l'URL (partageable, sans JavaScript) ; `hiddenFields` conserve les
 * autres paramètres de la page (mode TVA…). La clé sur PeriodChooser le
 * remonte quand l'URL change (choix et valeurs des champs relus).
 */
const EMPTY_HINT =
  "Une date de début et une date de fin, ou une seule date pour ce jour-là.";

export function PeriodForm({
  action,
  period,
  customPeriod,
  custom,
  range,
  hiddenFields = {},
  children,
  tools,
}: {
  action: string;
  /** La période prédéfinie de l'URL, appliquée tant qu'aucune plage n'est effective. */
  period: MetricPeriod;
  /** « Période personnalisée » choisie (ou des dates dans l'URL) : la zone de dates est ouverte. */
  customPeriod: boolean;
  /** La saisie « du / au » de l'URL ; `custom.range` = plage effective. */
  custom: DateRangeInput;
  range: DateRange;
  hiddenFields?: Record<string, string>;
  /** Champs propres à la page, sur la ligne des listes. */
  children?: ReactNode;
  /** Commandes de la page (liens), à droite de la ligne des listes. */
  tools?: ReactNode;
}) {
  const urlKey = `${customPeriod ? CUSTOM_PERIOD : period}-${custom.from ?? ""}-${custom.to ?? ""}`;
  return (
    <Form
      action={action}
      aria-label="Choix de la période"
      className="flex flex-col gap-4"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <PeriodChooser
        key={urlKey}
        period={period}
        customPeriod={customPeriod}
        tools={tools}
        zone={
          <DateRangeFields
            variant="zone"
            legend="Plage de dates"
            fromLabel="Du"
            toLabel="Au"
            idPrefix="periode"
            period={custom}
            caption={custom.range || custom.error ? undefined : EMPTY_HINT}
          />
        }
      >
        {children}
      </PeriodChooser>
      <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:items-center @xl/main:gap-4">
        <Button type="submit" className="w-full @xl/main:w-auto">
          <CalendarRange />
          Afficher
        </Button>
        <p className="text-muted-foreground text-xs">
          Période affichée : {formatPeriodFr(range.from, range.to)}.
        </p>
      </div>
    </Form>
  );
}
