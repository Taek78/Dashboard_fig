import Link from "next/link";
import { LoaderCircle, RotateCcw, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/input";
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
 * pendant la saisie), même présentation que celui des clients : une carte, un
 * grand champ avec icône et aide, puis les filtres secondaires sur une seconde
 * ligne. À la différence des clients, la grille complète est affichée d'emblée.
 * Clés d'URL : q, categorie, dispo, masques. Les produits masqués ne sont listés
 * que sur demande : le gestionnaire voit d'abord ce que voient ses clients.
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
          <div className="flex flex-col gap-3">
            <Label htmlFor="q" className="text-base">
              Rechercher un produit
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 group-aria-busy/recherche:hidden"
              />
              <LoaderCircle
                aria-hidden="true"
                className="text-primary pointer-events-none absolute top-1/2 left-3 hidden size-5 -translate-y-1/2 animate-spin group-aria-busy/recherche:block"
              />
              <NativeInput
                id="q"
                name="q"
                type="search"
                placeholder="Nom ou variété"
                defaultValue={filters.query ?? ""}
                className="h-11 pl-10 text-base"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 @2xl/main:flex-row @2xl/main:flex-wrap @2xl/main:items-end">
            <div className="grid gap-1.5 @2xl/main:w-44">
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
            <div className="grid gap-1.5 @2xl/main:w-44">
              <Label htmlFor="dispo">Disponibilité</Label>
              <NativeSelect
                id="dispo"
                name="dispo"
                defaultValue={dispo}
                className="w-full"
              >
                <NativeSelectOption value="">Tous</NativeSelectOption>
                <NativeSelectOption value="oui">Disponibles</NativeSelectOption>
                <NativeSelectOption value="non">
                  Indisponibles
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <Label
              htmlFor="masques"
              className="cursor-pointer self-start @2xl/main:self-end @2xl/main:pb-2"
            >
              <input
                id="masques"
                name="masques"
                type="checkbox"
                value="1"
                defaultChecked={filters.includeHidden === true}
                className="accent-primary size-4"
              />
              Inclure les produits masqués
            </Label>
            {isFiltered ? (
              <Link
                href="/catalogue"
                className={`${buttonVariants({ variant: "ghost" })} self-start @2xl/main:ml-auto @2xl/main:self-auto`}
              >
                <RotateCcw />
                Tout afficher
              </Link>
            ) : null}
          </div>
        </AutoSubmitForm>
      </CardContent>
    </Card>
  );
}
