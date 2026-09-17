import { LayoutGrid, User, Users } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { SortOrderToggle } from "@/components/sort-order-toggle";
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
  type DirectoryType,
} from "@/domain/customers/directory";
import type { ClientsSearch } from "@/domain/customers/schemas";
import { cn } from "@/lib/utils";

/*
 * Recherche commune de la section Clients (serveur ; AutoSubmitForm, client,
 * la lance pendant la saisie) : un seul champ pour les particuliers ET les
 * communautés, puis, dans le panneau des filtres, un COMMUTATEUR de type à
 * trois positions (particuliers, communautés, tous), chacune dans sa couleur
 * (tokens --individual, --community, marque pour « tous »), et un tri en deux
 * gestes : le critère dans la liste, le sens par le bouton à côté
 * (SortOrderToggle : flèche qui pivote, A / Z pour le nom, 1 / 9 pour les
 * nombres). Les champs deviennent l'URL (?q=&type=&tri=&sens=) : partageable,
 * retour arrière gratuit ; une nouvelle recherche revient en page 1.
 *
 * Le commutateur est un groupe de boutons radio natifs (un par position, le
 * bouton visible est l'étiquette) : accessible au clavier, coché = envoyé
 * aussitôt par AutoSubmitForm, sans JavaScript dédié. Le tri par membres
 * n'apparaît qu'en position « communautés ».
 */
const TYPE_ICONS: Record<DirectoryType, typeof User> = {
  tous: LayoutGrid,
  particuliers: User,
  communautes: Users,
};

const TYPE_CHECKED: Record<DirectoryType, string> = {
  tous: "has-checked:bg-primary/15 has-checked:text-primary has-checked:ring-primary/40",
  particuliers:
    "has-checked:bg-individual/15 has-checked:text-individual has-checked:ring-individual/40",
  communautes:
    "has-checked:bg-community/15 has-checked:text-community has-checked:ring-community/40",
};

export function CustomersSearch({
  search,
  canReset,
}: {
  search: ClientsSearch;
  canReset: boolean;
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
              <fieldset className="grid min-w-0 gap-1.5">
                <legend className="text-sm font-medium">Afficher</legend>
                <div
                  className="bg-card border-input inline-flex min-h-9 w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border p-0.5"
                  role="radiogroup"
                  aria-label="Afficher"
                >
                  {DIRECTORY_TYPES.map((type) => {
                    const Icon = TYPE_ICONS[type];
                    return (
                      <label
                        key={type}
                        title={DIRECTORY_TYPE_DESCRIPTIONS[type]}
                        className={cn(
                          "text-muted-foreground has-focus-visible:ring-ring relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors select-none has-checked:font-semibold has-checked:shadow-xs has-checked:ring-1 has-focus-visible:ring-2",
                          TYPE_CHECKED[type],
                        )}
                      >
                        {/* Le bouton radio natif couvre toute l'étiquette, invisible
                            mais bien là : clic, clavier et lecteurs d'écran passent
                            par lui, l'étiquette ne fait que l'habiller. */}
                        <input
                          type="radio"
                          name="type"
                          value={type}
                          defaultChecked={search.type === type}
                          className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                        />
                        {/* Icône masquée sur téléphone : les trois positions tiennent alors sur une ligne. */}
                        <Icon
                          aria-hidden="true"
                          className="hidden size-4 @xl/main:inline"
                        />
                        {DIRECTORY_TYPE_LABELS[type]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid min-w-0 gap-1.5 @2xl/main:max-w-sm">
                <Label htmlFor="tri">Trier par</Label>
                <div className="flex min-w-0 items-center gap-2">
                  <NativeSelect
                    id="tri"
                    name="tri"
                    defaultValue={search.sort}
                    className="min-w-0 flex-1"
                  >
                    {sortOptions(search.type).map((option) => (
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
