import { AutoSubmitForm } from "@/components/auto-submit-form";
import { CheckChip } from "@/components/check-chip";
import { FilterTray } from "@/components/filter-tray";
import { SearchField } from "@/components/search-field";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/domain/products/category";
import type { ProductFilters } from "@/domain/products/types";

/*
 * Moteur de recherche du catalogue (serveur ; AutoSubmitForm, client, la lance
 * pendant la saisie), même présentation que les autres recherches : la barre
 * de recherche, puis le panneau des filtres (catégorie, disponibilité, puce
 * des produits masqués). À la différence des clients, la grille complète est
 * affichée d'emblée. Clés d'URL : q, categorie, dispo, masques. Les produits
 * masqués ne sont listés que sur demande : le gestionnaire voit d'abord ce
 * que voient ses clients.
 */
export function ProductsFilters({ filters }: { filters: ProductFilters }) {
  const isFiltered =
    filters.category !== undefined ||
    filters.query !== undefined ||
    filters.availability !== undefined ||
    filters.includeHidden === true;
  const dispo =
    filters.availability === "available"
      ? "oui"
      : filters.availability === "unavailable"
        ? "non"
        : "";

  return (
    <Card>
      <CardContent>
        <AutoSubmitForm
          action="/catalogue"
          aria-label="Recherche et filtres du catalogue"
          className="flex flex-col gap-4"
        >
          <SearchField
            label="Rechercher un produit"
            placeholder="Nom ou variété"
            defaultValue={filters.query}
          />

          <FilterTray
            reset={
              isFiltered ? { href: "/catalogue", label: "Tout afficher" } : null
            }
          >
            <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_auto] @2xl/main:items-end">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="categorie">Catégorie</Label>
                <NativeSelect
                  id="categorie"
                  name="categorie"
                  defaultValue={filters.category ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">
                    Fruits et légumes
                  </NativeSelectOption>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {PRODUCT_CATEGORY_LABELS[c]}s
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="dispo">Disponibilité</Label>
                <NativeSelect
                  id="dispo"
                  name="dispo"
                  defaultValue={dispo}
                  className="w-full"
                >
                  <NativeSelectOption value="">Tous</NativeSelectOption>
                  <NativeSelectOption value="oui">
                    Disponibles
                  </NativeSelectOption>
                  <NativeSelectOption value="non">
                    Indisponibles
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <CheckChip
                id="masques"
                name="masques"
                value="1"
                defaultChecked={filters.includeHidden === true}
                className="col-span-2 justify-self-start @2xl/main:col-span-1"
              >
                Inclure les produits masqués
              </CheckChip>
            </div>
          </FilterTray>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
