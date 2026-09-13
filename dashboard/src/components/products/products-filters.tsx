import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
 * Moteur de recherche du catalogue (serveur, formulaire GET via next/form), même
 * présentation que celui des clients : une carte, un grand champ avec icône et
 * aide, le bouton « Rechercher », puis les filtres secondaires sur une seconde
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
        <Form
          action="/catalogue"
          aria-label="Recherche et filtres du catalogue"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-3">
            <Label htmlFor="q" className="text-base">
              Rechercher un produit
            </Label>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                />
                <Input
                  key={filters.query ?? ""}
                  id="q"
                  name="q"
                  type="search"
                  placeholder="Nom ou variété"
                  defaultValue={filters.query ?? ""}
                  aria-describedby="q-help"
                  className="h-11 pl-10 text-base"
                />
              </div>
              <Button type="submit" size="lg" className="md:w-40">
                <Search />
                Rechercher
              </Button>
            </div>
            <p id="q-help" className="text-muted-foreground text-sm">
              Une partie suffit : « pom », « gala », « cœur ». Accents et
              majuscules sont ignorés.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:flex-wrap md:items-end">
            <div className="grid gap-1.5 md:w-44">
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
            <div className="grid gap-1.5 md:w-44">
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
              className="cursor-pointer self-start md:self-end md:pb-2"
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
            <div className="flex gap-2 md:ml-auto">
              <Button
                type="submit"
                variant="outline"
                className="flex-1 md:flex-none"
              >
                Appliquer les filtres
              </Button>
              {isFiltered ? (
                <Button
                  variant="ghost"
                  className="flex-1 md:flex-none"
                  render={<Link href="/catalogue" />}
                >
                  Tout afficher
                </Button>
              ) : null}
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
