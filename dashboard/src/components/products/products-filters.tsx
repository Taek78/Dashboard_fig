import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

/* Filtres du catalogue : formulaire GET (next/form), composant serveur. Clés d'URL : categorie, q, dispo. */
export function ProductsFilters({ filters }: { filters: ProductFilters }) {
  const isFiltered =
    filters.category !== undefined ||
    filters.query !== undefined ||
    filters.availability !== undefined;
  const dispo =
    filters.availability === "available"
      ? "oui"
      : filters.availability === "unavailable"
        ? "non"
        : "";

  return (
    <Form
      action="/catalogue"
      aria-label="Filtres du catalogue"
      className="flex flex-col gap-3 md:flex-row md:items-end"
    >
      <div className="grid gap-1.5 md:w-56">
        <Label htmlFor="q">Rechercher</Label>
        <Input
          id="q"
          name="q"
          type="search"
          placeholder="Nom du produit"
          defaultValue={filters.query ?? ""}
        />
      </div>
      <div className="grid gap-1.5 md:w-44">
        <Label htmlFor="categorie">Catégorie</Label>
        <NativeSelect
          id="categorie"
          name="categorie"
          defaultValue={filters.category ?? ""}
          className="w-full"
        >
          <NativeSelectOption value="">Toutes</NativeSelectOption>
          {PRODUCT_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {PRODUCT_CATEGORY_LABELS[c]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5 md:w-40">
        <Label htmlFor="dispo">Disponibilité</Label>
        <NativeSelect
          id="dispo"
          name="dispo"
          defaultValue={dispo}
          className="w-full"
        >
          <NativeSelectOption value="">Tous</NativeSelectOption>
          <NativeSelectOption value="oui">En vente</NativeSelectOption>
          <NativeSelectOption value="non">Retirés</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Filtrer</Button>
        {isFiltered ? (
          <Button variant="ghost" render={<Link href="/catalogue" />}>
            Réinitialiser
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
