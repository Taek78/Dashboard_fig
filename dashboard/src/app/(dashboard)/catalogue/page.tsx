import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ProductsFilters } from "@/components/products/products-filters";
import { ProductsTable } from "@/components/products/products-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getProducts } from "@/data/products";
import { parseProductFilters } from "@/domain/products/schemas";

/* Catalogue et stocks (A4) : liste filtrable, chaque produit mène à sa fiche éditable. */
export const metadata: Metadata = { title: "Catalogue" };

export default async function CataloguePage({
  searchParams,
}: PageProps<"/catalogue">) {
  const filters = parseProductFilters(await searchParams);
  const products = await getProducts(filters);
  const count = products.length;

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Produits, prix et stocks proposés dans l'application."
      />
      <div className="flex flex-col gap-4">
        <ProductsFilters filters={filters} />
        <p role="status" className="text-muted-foreground text-sm">
          {count} produit{count > 1 ? "s" : ""}
        </p>
        {count > 0 ? (
          <ProductsTable products={products} />
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
              >
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Aucun produit ne correspond</EmptyTitle>
              <EmptyDescription>
                Modifiez la recherche ou les filtres.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" render={<Link href="/catalogue" />}>
                Réinitialiser les filtres
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </>
  );
}
