import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { CatalogSettingsForm } from "@/components/products/catalog-settings-form";
import { ProductsFilters } from "@/components/products/products-filters";
import {
  ProductsResults,
  ProductsResultsSkeleton,
} from "@/components/products/products-results";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalogSettings } from "@/data/products";
import { getCurrentUser } from "@/data/session";
import { canEditProduct } from "@/domain/auth/roles";
import { parseProductFilters } from "@/domain/products/schemas";

/*
 * Catalogue : moteur de recherche en tête (même
 * présentation que les clients), grille complète affichée d'emblée. La page ne
 * fait aucun await de données elle-même : la grille charge dans son propre
 * <Suspense>, le moteur reste en place pendant la recherche (pas de loading.tsx
 * pour ce segment, c'est voulu). Entre les deux, le paramètre du catalogue
 * (laisser en vente à stock 0), dans son propre <Suspense> : il n'est pas
 * rechargé à chaque recherche. ?supprime=1 confirme une suppression.
 */
export const metadata: Metadata = { title: "Catalogue" };

export default async function CataloguePage({
  searchParams,
}: PageProps<"/catalogue">) {
  const raw = await searchParams;
  const filters = parseProductFilters(raw);
  const justDeleted = raw.supprime === "1";
  const key = JSON.stringify(filters);

  return (
    <>
      <PageHeader
        title="Catalogue"
        actions={
          <Button render={<Link href="/catalogue/nouveau" />}>
            <Plus />
            Nouveau produit
          </Button>
        }
      />
      {justDeleted ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Produit supprimé.
        </p>
      ) : null}
      <ProductsFilters filters={filters} />
      <Suspense fallback={<Skeleton className="h-12 rounded-xl" />}>
        <CatalogSettingsPanel />
      </Suspense>
      <Suspense key={key} fallback={<ProductsResultsSkeleton />}>
        <ProductsResults filters={filters} />
      </Suspense>
    </>
  );
}

async function CatalogSettingsPanel() {
  const [settings, user] = await Promise.all([
    getCatalogSettings(),
    getCurrentUser(),
  ]);
  return (
    <CatalogSettingsForm
      sellWhenOutOfStock={settings.sellWhenOutOfStock}
      canEdit={canEditProduct(user.role)}
    />
  );
}
