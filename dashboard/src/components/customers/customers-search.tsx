import { LayoutGrid, User, Users } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { SortOrderToggle } from "@/components/sort-order-toggle";
import { TypeSwitch, type TypeSwitchOption } from "@/components/type-switch";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DEFAULT_DIRECTORY_ORDER,
  DIRECTORY_SORT_SCALES,
  DIRECTORY_TYPE_DESCRIPTIONS,
  DIRECTORY_TYPE_LABELS,
  DIRECTORY_TYPES,
  SORT_ORDER_LABELS,
  sortOptions,
} from "@/domain/customers/directory";
import type { ClientsSearch } from "@/domain/customers/schemas";

/*
 * Recherche commune de la section Clients (serveur ; AutoSubmitForm, client,
 * la lance pendant la saisie) : un seul champ pour les particuliers ET les
 * communautés, puis, dans le panneau des filtres, le COMMUTATEUR de type à
 * trois positions (particuliers, communautés, tous ; TypeSwitch, chacune
 * dans sa couleur) et un tri en deux gestes : le critère dans la liste, le
 * sens par le bouton à côté (SortOrderToggle : flèche qui pivote, A / Z pour
 * le nom, 1 / 9 pour les nombres). Les champs deviennent l'URL
 * (?q=&type=&tri=&sens=) : partageable, retour arrière gratuit ; une
 * nouvelle recherche revient en page 1. Le tri par membres n'apparaît qu'en
 * position « communautés ».
 */
const TYPE_OPTIONS: readonly TypeSwitchOption[] = DIRECTORY_TYPES.map(
  (type) => ({
    value: type,
    label: DIRECTORY_TYPE_LABELS[type],
    title: DIRECTORY_TYPE_DESCRIPTIONS[type],
    icon: type === "tous" ? LayoutGrid : type === "particuliers" ? User : Users,
    tone:
      type === "tous"
        ? "brand"
        : type === "particuliers"
          ? "individual"
          : "community",
  }),
);

export function CustomersSearch({
  search,
  canReset,
  showSpending = true,
}: {
  search: ClientsSearch;
  canReset: boolean;
  /** Faux pour le livreur : pas de tri par montant dépensé. */
  showSpending?: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/clients"
          aria-label="Recherche de clients"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher un client ou une communauté"
            placeholder="Nom, e-mail, téléphone, ville, communauté, code de parrainage…"
            maxLength={64}
            defaultValue={search.query}
          />

          <FilterTray reset={canReset ? { href: "/clients" } : null}>
            <div className="grid gap-3 @2xl/main:grid-cols-[auto_minmax(0,1fr)] @2xl/main:items-end">
              <TypeSwitch
                legend="Afficher"
                name="type"
                value={search.type}
                options={TYPE_OPTIONS}
              />
              <div className="grid min-w-0 gap-1.5 @2xl/main:max-w-sm">
                <Label htmlFor="tri">Trier par</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <NativeSelect
                    id="tri"
                    name="tri"
                    defaultValue={search.sort}
                    className="min-w-0 flex-1"
                  >
                    {sortOptions(search.type, showSpending).map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <SortOrderToggle
                    selectId="tri"
                    sort={search.sort}
                    order={search.order}
                    naturalOrders={DEFAULT_DIRECTORY_ORDER}
                    scales={DIRECTORY_SORT_SCALES}
                    labels={SORT_ORDER_LABELS}
                  />
                </div>
              </div>
            </div>
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
