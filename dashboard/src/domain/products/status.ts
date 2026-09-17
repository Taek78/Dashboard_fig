import type { Product } from "@/domain/products/types";

/*
 * Statut de vente d'un produit, DÉDUIT (jamais stocké) de trois champs et d'un
 * paramètre du catalogue (décisions du client, 2026-09-16) :
 *   - masqué : absent de l'application (visible = false) ;
 *   - indisponible : retiré de la vente à la main (available = false) ;
 *   - rupture de stock : stock à 0, sauf si le catalogue laisse en vente les
 *     produits épuisés (CatalogSettings.sellWhenOutOfStock) ;
 *   - en vente : le reste.
 * L'ordre compte : un produit masqué ET épuisé est « masqué ». L'application
 * FIG applique la même règle pour savoir si un produit s'achète.
 */
export const PRODUCT_SALE_STATUSES = [
  "en_vente",
  "rupture",
  "indisponible",
  "masque",
] as const;
export type ProductSaleStatus = (typeof PRODUCT_SALE_STATUSES)[number];

export const PRODUCT_SALE_STATUS_LABELS: Record<ProductSaleStatus, string> = {
  en_vente: "En vente",
  rupture: "Rupture de stock",
  indisponible: "Indisponible",
  masque: "Masqué",
};

/** Paramètres du catalogue, une seule ligne en base (table catalog_settings). */
export type CatalogSettings = {
  /** Un produit à stock 0 reste « en vente » : son statut ne change pas. */
  sellWhenOutOfStock: boolean;
};

export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = {
  sellWhenOutOfStock: false,
};

export function productSaleStatus(
  product: Pick<Product, "visible" | "available" | "stockQuantity">,
  settings: CatalogSettings,
): ProductSaleStatus {
  if (!product.visible) return "masque";
  if (!product.available) return "indisponible";
  if (product.stockQuantity <= 0 && !settings.sellWhenOutOfStock) {
    return "rupture";
  }
  return "en_vente";
}
