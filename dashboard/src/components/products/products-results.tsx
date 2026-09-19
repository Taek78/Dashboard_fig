import Link from "next/link";
import { Plus, SearchX } from "lucide-react";
import { gridClass, ProductsGrid } from "@/components/products/products-grid";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getCatalogSettings, getProducts } from "@/data/products";
import { getCurrentUser } from "@/data/session";
import { canEditProduct } from "@/domain/auth/roles";
import type { ProductFilters } from "@/domain/products/types";

/*
 * Zone de résultats du catalogue, composant serveur ASYNC rendu dans un
 * <Suspense> par la page : pendant la recherche, seule la grille montre son
 * squelette, le moteur au-dessus reste en place (même mécanique que les clients).
 */
export async function ProductsResults({
  filters,
}: {
  filters: ProductFilters;
}) {
  const [products, settings, user] = await Promise.all([
    getProducts(filters),
    getCatalogSettings(),
    getCurrentUser(),
  ]);
  const canEdit = canEditProduct(user.role);
  const count = products.length;
  const scope = filters.query ? ` pour « ${filters.query} »` : "";

  if (count === 0) {
    return (
      <Empty className="bg-card/60 min-h-[40vh] rounded-none border border-dashed">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
          >
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Aucun produit{scope}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          <Button variant="outline" render={<Link href="/catalogue" />}>
            Tout afficher
          </Button>
          <Button render={<Link href="/catalogue/nouveau" />}>
            <Plus />
            Nouveau produit
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        {count} produit{count > 1 ? "s" : ""}
        {scope}
        {filters.includeHidden ? ", produits masqués inclus" : ""}
      </p>
      <ProductsGrid products={products} settings={settings} canEdit={canEdit} />
    </div>
  );
}

const CARDS = [1, 2, 3, 4, 5, 6, 7];

/** Squelette de la grille : même disposition, annonce sr-only. */
export function ProductsResultsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        Recherche en cours…
      </p>
      <div className={gridClass}>
        <Skeleton className="min-h-20 rounded-none @xl/main:min-h-72" />
        {CARDS.map((i) => (
          <div
            key={i}
            className="bg-card ring-foreground/10 overflow-hidden rounded-none ring-1"
          >
            <Skeleton className="h-36 rounded-none" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
