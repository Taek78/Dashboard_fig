import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ProductCard } from "@/components/products/product-card";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProduct } from "@/data/products";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/products/category";
import { productIdSchema } from "@/domain/products/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Fiche produit (A4, revue le 2026-09-13) : à gauche l'aperçu (la carte telle
 * qu'elle apparaît dans la grille, mise à jour après chaque enregistrement), à
 * droite le formulaire complet, puis la zone de suppression. ?cree=1 confirme une
 * création (l'action de création redirige ici).
 */
export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProduitPage({
  params,
  searchParams,
}: PageProps<"/catalogue/[id]">) {
  const { id } = await params;
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const product = await getProduct(parsed.data);
  if (!product) notFound();
  const justCreated = (await searchParams).cree === "1";

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.variety ? `${product.variety} · ` : ""}${PRODUCT_CATEGORY_LABELS[product.category]} · modifié le ${formatDateFr(product.updatedAt)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/catalogue" />}
          >
            <ArrowLeft />
            Retour au catalogue
          </Button>
        }
      />
      {justCreated ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Produit créé. Vous pouvez encore ajuster sa fiche ci-dessous.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Aperçu dans le catalogue</h2>
          <ProductCard product={product} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Modifier la fiche</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <ProductForm product={product} />
            <div className="border-t pt-6">
              <DeleteProductButton
                productId={product.id}
                productName={product.name}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
