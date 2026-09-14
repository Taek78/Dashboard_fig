import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductCard } from "@/components/products/product-card";
import type { Product } from "@/domain/products/types";

/*
 * Grille du catalogue (serveur). La première tuile est le bouton « Nouveau
 * produit » : créer se fait au même endroit que parcourir, à la même taille
 * qu'une carte, pour être trouvé sans chercher. Sur mobile (une colonne), la
 * tuile devient une ligne compacte : une grande tuile vide repousserait les
 * produits sous le pli. `canEdit` affiche la barre d'actions de chaque carte.
 */
export const gridClass =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function ProductsGrid({
  products,
  canEdit,
}: {
  products: Product[];
  canEdit: boolean;
}) {
  return (
    <ul className={gridClass}>
      {canEdit ? (
        <li>
          <Link
            href="/catalogue/nouveau"
            className="text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring flex h-full flex-row items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition-colors outline-none focus-visible:ring-2 sm:min-h-72 sm:flex-col sm:justify-center sm:p-6 sm:text-center"
          >
            <span className="bg-gradient-brand flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:size-12">
              <Plus className="size-5 sm:size-6" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5 sm:gap-1">
              <span className="font-medium">Nouveau produit</span>
              <span className="text-xs">
                Ajouter un fruit ou un légume au catalogue
              </span>
            </span>
          </Link>
        </li>
      ) : null}
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} canEdit={canEdit} />
        </li>
      ))}
    </ul>
  );
}
