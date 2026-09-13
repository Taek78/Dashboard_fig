import type { ProductCategory } from "@/domain/products/category";

/*
 * Types métier du catalogue (A4) : le vocabulaire du FRONT, mappé sur le schéma
 * du client en B3.
 *
 * Conventions : prix en centimes entiers (`priceCents`), rapporté à l'unité de
 * vente : par kilo quand `unit` vaut "g", par pièce sinon. Le stock est en unité de
 * base (grammes ou pièces), comme les quantités de commande.
 */
export type ProductUnit = "piece" | "g";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  /** Par kg si unit = "g", par pièce sinon. */
  priceCents: number;
  available: boolean;
  /** Grammes ou pièces selon unit. */
  stockQuantity: number;
  /** ISO 8601, dernière modification. */
  updatedAt: string;
};

/** Filtres de la liste, déjà validés par parseProductFilters. */
export type ProductFilters = {
  category?: ProductCategory;
  /** Recherche insensible à la casse et aux accents sur le nom. */
  query?: string;
  availability?: "available" | "unavailable";
};

/** Ce que la fiche peut modifier : rien d'autre (ni le nom, ni l'unité, ni la catégorie en A4). */
export type ProductPatch = {
  priceCents: number;
  available: boolean;
  stockQuantity: number;
};
