import type {
  Container,
  Illustration,
  OriginCountry,
  ProductCategory,
} from "@/domain/products/category";

/*
 * Types métier du catalogue : le vocabulaire du FRONT, converti depuis les lignes
 * Postgres par src/db/mappers.ts.
 *
 * Prix : `priceCents` est le prix de l'unité de vente : par kilo quand `unit`
 * vaut "g", par pièce sinon. Pour une pièce dont on connaît le poids moyen
 * (`unitWeightGrams`), le prix au kilo se DÉDUIT (rules.ts) : on ne stocke jamais
 * deux prix qui pourraient se contredire. Le stock est en unité de base.
 */
export type ProductUnit = "piece" | "g";

export type Caliber = { minMm: number; maxMm: number };

export type Product = {
  id: string;
  name: string;
  /** Ex. « Gala », « Cœur de bœuf ». */
  variety: string | null;
  category: ProductCategory;
  unit: ProductUnit;
  /** Par kg si unit = "g", par pièce sinon. */
  priceCents: number;
  /** Poids moyen d'une pièce, pour déduire le prix au kilo. Sans objet si unit = "g". */
  unitWeightGrams: number | null;
  container: Container;
  originCountry: OriginCountry;
  /** Région ou précision libre : « Val de Loire », « Sicile ». */
  originRegion: string | null;
  caliber: Caliber | null;
  organic: boolean;
  inSeason: boolean;
  /** Proposé à la vente dans l'application. */
  available: boolean;
  /** Affiché dans l'application (un produit masqué n'est ni visible ni achetable). */
  visible: boolean;
  /** Grammes ou pièces selon unit. */
  stockQuantity: number;
  illustration: Illustration;
  /** Visuel fourni par le client (https). Prend le pas sur l'illustration. */
  imageUrl: string | null;
  /** ISO 8601, dernière modification. */
  updatedAt: string;
};

/** Tout ce qu'un formulaire peut définir : Product sans les champs gérés par la source. */
export type ProductInput = Omit<Product, "id" | "updatedAt">;

/** Filtres de la liste, déjà validés par parseProductFilters. */
export type ProductFilters = {
  category?: ProductCategory;
  /** Recherche insensible à la casse et aux accents sur le nom et la variété. */
  query?: string;
  availability?: "available" | "unavailable";
  /** Par défaut, les produits masqués ne sont pas listés. */
  includeHidden?: boolean;
};
