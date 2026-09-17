import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { DuplicateProductButton } from "@/components/products/duplicate-product-button";
import { ProductCard } from "@/components/products/product-card";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalogSettings, getProduct } from "@/data/products";
import { getCurrentUser } from "@/data/session";
import { canEditProduct } from "@/domain/auth/roles";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/products/category";
import { productIdSchema } from "@/domain/products/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Fiche produit : à gauche l'aperçu (la carte telle
 * qu'elle apparaît dans la grille, mise à jour après chaque enregistrement), à
 * droite le formulaire complet, puis dupliquer et supprimer. ?cree=1 confirme
 * une création, ?duplique=1 une duplication (les actions redirigent ici).
 */
export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProduitPage({
  params,
  searchParams,
}: PageProps<"/catalogue/[id]">) {
  const { id } = await params;
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const [product, settings, user, raw] = await Promise.all([
    getProduct(parsed.data),
    getCatalogSettings(),
    getCurrentUser(),
    searchParams,
  ]);
  if (!product) notFound();
  const justCreated = raw.cree === "1";
  const justDuplicated = raw.duplique === "1";
  const canEdit = canEditProduct(user.role);

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
      {justCreated || justDuplicated ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          {justDuplicated
            ? "Copie créée, masquée dans l'application : relisez la fiche, renommez-la, puis cochez « Visible »."
            : "Produit créé. Vous pouvez encore ajuster sa fiche ci-dessous."}
        </p>
      ) : null}
      <div className="grid gap-6 @4xl/main:grid-cols-[minmax(16rem,20rem)_1fr]">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Aperçu dans le catalogue</h2>
          <ProductCard product={product} settings={settings} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Modifier la fiche</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <ProductForm product={product} />
            {canEdit ? (
              <div className="flex flex-wrap items-start gap-3 border-t pt-6">
                <DuplicateProductButton productId={product.id} />
                <DeleteProductButton
                  productId={product.id}
                  productName={product.name}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
