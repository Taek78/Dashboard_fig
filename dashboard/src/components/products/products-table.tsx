import Link from "next/link";
import { tableFrame } from "@/components/orders/orders-table";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/products/category";
import { isLowStock } from "@/domain/products/rules";
import type { Product } from "@/domain/products/types";
import { formatEuros, formatQuantity } from "@/lib/format";

/*
 * Tableau du catalogue. Composant serveur. Le nom est le lien vers la fiche ;
 * le stock bas et l'indisponibilité sont signalés par un badge ET un texte.
 */
const hideOnMobile = "hidden md:table-cell";
const numeric = "text-right tabular-nums";

export function unitLabel(unit: Product["unit"]): string {
  return unit === "g" ? "le kg" : "la pièce";
}

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <div className={tableFrame}>
      <Table>
        <TableCaption className="sr-only">
          Produits du catalogue avec prix, stock et disponibilité.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Produit</TableHead>
            <TableHead scope="col" className={hideOnMobile}>
              Catégorie
            </TableHead>
            <TableHead scope="col" className={numeric}>
              Prix
            </TableHead>
            <TableHead scope="col" className={numeric}>
              Stock
            </TableHead>
            <TableHead scope="col">Disponibilité</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/catalogue/${product.id}`}
                  className="underline-offset-4 hover:underline focus-visible:underline"
                >
                  {product.name}
                </Link>
              </TableCell>
              <TableCell className={hideOnMobile}>
                {PRODUCT_CATEGORY_LABELS[product.category]}
              </TableCell>
              <TableCell className={numeric}>
                {formatEuros(product.priceCents)}{" "}
                <span className="text-muted-foreground text-xs">
                  / {unitLabel(product.unit)}
                </span>
              </TableCell>
              <TableCell className={numeric}>
                {formatQuantity(product.stockQuantity, product.unit)}
                {isLowStock(product) ? (
                  <Badge variant="warning" className="ml-2">
                    Stock bas
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                {product.available ? (
                  <Badge variant="success">En vente</Badge>
                ) : (
                  <Badge variant="outline">Retiré</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
