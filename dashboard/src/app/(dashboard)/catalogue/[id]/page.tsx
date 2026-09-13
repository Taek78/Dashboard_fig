import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/product-form";
import { unitLabel } from "@/components/products/products-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProduct } from "@/data/products";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/products/category";
import { centsToEurosInput, isLowStock } from "@/domain/products/rules";
import { productIdSchema } from "@/domain/products/schemas";
import { formatDateFr, formatEuros, formatQuantity } from "@/lib/format";

/* Fiche produit (A4) : lecture à gauche, édition à droite. params validé, notFound() si absent. */
export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProduitPage({
  params,
}: PageProps<"/catalogue/[id]">) {
  const { id } = await params;
  const parsed = productIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const product = await getProduct(parsed.data);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${PRODUCT_CATEGORY_LABELS[product.category]} · vendu ${unitLabel(product.unit) === "le kg" ? "au kilo" : "à la pièce"}`}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>État actuel</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Prix</dt>
              <dd className="font-medium tabular-nums">
                {formatEuros(product.priceCents)} / {unitLabel(product.unit)}
              </dd>
              <dt className="text-muted-foreground">Stock</dt>
              <dd className="flex items-center gap-2 font-medium tabular-nums">
                {formatQuantity(product.stockQuantity, product.unit)}
                {isLowStock(product) ? (
                  <Badge variant="warning">Stock bas</Badge>
                ) : null}
              </dd>
              <dt className="text-muted-foreground">Disponibilité</dt>
              <dd>
                {product.available ? (
                  <Badge variant="success">En vente</Badge>
                ) : (
                  <Badge variant="outline">Retiré</Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">Modifié le</dt>
              <dd className="font-medium">{formatDateFr(product.updatedAt)}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Modifier</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              productId={product.id}
              priceEurosDefault={centsToEurosInput(product.priceCents)}
              availableDefault={product.available}
              stockDefault={product.stockQuantity}
              unitLabel={unitLabel(product.unit)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
