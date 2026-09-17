import { LoaderCircle } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { DateRangeFields } from "@/components/date-range-fields";
import { ResetLink } from "@/components/filter-tray";
import type { DateRangeInput } from "@/lib/days";

/*
 * Période de l'historique d'un client (serveur ; AutoSubmitForm, client, la
 * lance dès qu'une date est choisie, vers la fiche elle-même) : la zone de
 * dates seule, sur sa propre surface (DateRangeFields en variante « zone » :
 * une date = ce jour-là, dates inversées = erreur), avec le lien « Toutes les
 * dates » et l'indicateur de recherche dans son en-tête. Les champs
 * deviennent l'URL de la fiche (?du=&au=) et la pagination repart à la
 * première page ; la position de défilement est gardée, l'historique est en
 * bas de la fiche.
 */
export function CustomerHistoryFilters({
  customerId,
  period,
}: {
  customerId: string;
  period: DateRangeInput;
}) {
  const active = period.from !== undefined || period.to !== undefined;

  return (
    <AutoSubmitForm
      action={`/clients/${customerId}`}
      aria-label="Période de l'historique"
      className="flex flex-col"
    >
      <DateRangeFields
        variant="zone"
        legend="Période de livraison"
        fromLabel="Livraison du"
        toLabel="Livraison au"
        idPrefix="historique"
        period={period}
        className="@2xl/main:max-w-2xl"
        aside={
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs group-aria-busy/recherche:inline-flex">
              <LoaderCircle
                aria-hidden="true"
                className="text-primary size-3.5 animate-spin"
              />
              Recherche…
            </span>
            {active ? (
              <ResetLink
                href={`/clients/${customerId}`}
                label="Toutes les dates"
                scroll={false}
              />
            ) : null}
          </span>
        }
      />
    </AutoSubmitForm>
  );
}
