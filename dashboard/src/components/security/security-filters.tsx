import { AutoSubmitForm } from "@/components/auto-submit-form";
import { CheckChip } from "@/components/check-chip";
import { DateRangeFields } from "@/components/date-range-fields";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { Card, CardContent } from "@/components/ui/card";
import {
  SECURITY_FAMILIES,
  SECURITY_FAMILY_LABELS,
} from "@/domain/security/events";
import {
  SECURITY_SEARCH_MAX_LENGTH,
  type SecurityFilters,
} from "@/domain/security/types";
import type { DateRangeInput } from "@/lib/days";

/*
 * Recherche et filtres du journal (serveur ; AutoSubmitForm, client, relance
 * la recherche pendant la saisie). Même disposition que les autres listes :
 * la barre de recherche, puis le panneau des filtres, la zone de dates en
 * dernier et pleine largeur.
 *
 * Les familles sont des cases à cocher qui s'additionnent (aucune cochée =
 * tout le journal), parce qu'une enquête regarde souvent deux familles à la
 * fois : « connexion » et « comptes », par exemple. La recherche libre, elle,
 * porte sur ce qu'on connaît déjà d'un incident : une adresse e-mail, une
 * adresse IP, un identifiant de compte ou de commande.
 */
export function SecurityFilters({
  filters,
  period,
  canReset,
}: {
  filters: SecurityFilters;
  period: DateRangeInput;
  canReset: boolean;
}) {
  const checked = new Set(filters.families ?? []);

  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/journal"
          aria-label="Recherche et filtres du journal"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher dans le journal"
            placeholder="Adresse e-mail, adresse IP, identifiant, type d'événement…"
            maxLength={SECURITY_SEARCH_MAX_LENGTH}
            defaultValue={filters.query}
          />

          <FilterTray reset={canReset ? { href: "/journal" } : null}>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="text-muted-foreground mb-2 text-sm">
                Familles d&apos;événements
              </legend>
              {SECURITY_FAMILIES.map((family) => (
                <CheckChip
                  key={family}
                  id={`famille-${family}`}
                  name="famille"
                  value={family}
                  defaultChecked={checked.has(family)}
                >
                  {SECURITY_FAMILY_LABELS[family]}
                </CheckChip>
              ))}
            </fieldset>

            <DateRangeFields
              legend="Jour de l'événement"
              fromLabel="Du"
              toLabel="Au"
              idPrefix="journal"
              period={period}
            />
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
