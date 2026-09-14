import type { Product, ProductFilters } from "@/domain/products/types";
import { normalize } from "@/lib/text";

/*
 * Règles pures du catalogue, testées dans test/domain/products/rules.test.ts.
 */

/**
 * Prix saisi en euros ("12,50", "12.5", "12", " 3,20 € ") → centimes entiers, ou
 * null si la saisie n'est pas un montant strictement positif à deux décimales
 * maximum. La conversion vit ici, une fois : le formulaire parle en euros, tout le
 * reste du système en centimes.
 */
export function eurosToCents(input: string): number | null {
  const cleaned = input.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 ? cents : null;
}

/** Centimes → valeur par défaut d'un champ de saisie en euros : 1250 → "12,50". */
export function centsToEurosInput(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${euros},${String(rest).padStart(2, "0")}`;
}

/** « le kg » ou « la pièce » : l'unité de vente telle qu'on l'écrit après un prix. */
export function unitLabel(unit: Product["unit"]): string {
  return unit === "g" ? "le kg" : "la pièce";
}

/**
 * Prix au kilo, déduit : le prix lui-même pour un produit au poids ; pour une
 * pièce, priceCents rapporté au poids moyen ; null si ce poids est inconnu.
 */
export function pricePerKgCents(
  product: Pick<Product, "unit" | "priceCents" | "unitWeightGrams">,
): number | null {
  if (product.unit === "g") return product.priceCents;
  if (!product.unitWeightGrams || product.unitWeightGrams <= 0) return null;
  return Math.round((product.priceCents * 1000) / product.unitWeightGrams);
}

/** Prix unitaire (par pièce) : le prix lui-même pour une pièce, null pour un produit au poids. */
export function unitPriceCents(
  product: Pick<Product, "unit" | "priceCents">,
): number | null {
  return product.unit === "piece" ? product.priceCents : null;
}

export function filterProducts(
  products: readonly Product[],
  filters: ProductFilters,
): Product[] {
  const query = filters.query ? normalize(filters.query) : undefined;
  return products.filter((product) => {
    const visibleOk = filters.includeHidden === true || product.visible;
    const categoryOk =
      filters.category === undefined || product.category === filters.category;
    const queryOk =
      query === undefined ||
      normalize(`${product.name} ${product.variety ?? ""}`).includes(query);
    const availabilityOk =
      filters.availability === undefined ||
      product.available === (filters.availability === "available");
    return visibleOk && categoryOk && queryOk && availabilityOk;
  });
}

/** Copie triée par nom (ordre français : accents et majuscules ignorés). */
export function sortProductsByName(products: readonly Product[]): Product[] {
  return products.toSorted((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Seuil d'alerte par unité : sous 2 kg ou sous 10 pièces, le stock est bas. */
export const LOW_STOCK_THRESHOLD = { g: 2000, piece: 10 } as const;

export function isLowStock(
  product: Pick<Product, "unit" | "stockQuantity">,
): boolean {
  return product.stockQuantity < LOW_STOCK_THRESHOLD[product.unit];
}

/** « 70–80 mm » ; « 60 mm » si les bornes sont égales ; null si le calibre est inconnu. */
export function formatCaliber(caliber: Product["caliber"]): string | null {
  if (!caliber) return null;
  return caliber.minMm === caliber.maxMm
    ? `${caliber.minMm} mm`
    : `${caliber.minMm}–${caliber.maxMm} mm`;
}

/**
 * Nom d'une copie : « Pommes » → « Pommes (copie) », « Pommes (copie) » →
 * « Pommes (copie 2) », borné à 80 caractères comme le formulaire.
 */
export function duplicateName(name: string): string {
  const match = /^(.*?) \(copie(?: (\d+))?\)$/.exec(name);
  const base = match ? match[1]! : name;
  const n = match ? Number(match[2] ?? "1") + 1 : 1;
  const suffix = n === 1 ? " (copie)" : ` (copie ${n})`;
  return `${base.slice(0, 80 - suffix.length)}${suffix}`;
}
