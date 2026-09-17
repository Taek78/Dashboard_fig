import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productToRow, toProduct } from "@/db/mappers";
import { catalogSettings, products } from "@/db/schema";
import { filterProducts, sortProductsByName } from "@/domain/products/rules";
import {
  DEFAULT_CATALOG_SETTINGS,
  type CatalogSettings,
} from "@/domain/products/status";
import type { ProductsSource } from "@/domain/products/source";
import type { ProductFilters, ProductInput } from "@/domain/products/types";

/*
 * Implémentation Drizzle du contrat ProductsSource. Le catalogue est petit
 * (quelques dizaines de références) : on charge tout puis on applique les mêmes
 * règles pures du domaine (recherche sans accents, tri français), plutôt que
 * de réécrire la normalisation en SQL. À revoir si le catalogue dépasse
 * quelques milliers de lignes (extension pg_trgm ou unaccent).
 */
async function readCatalogSettings(): Promise<CatalogSettings> {
  const [row] = await getDb()
    .select({ sellWhenOutOfStock: catalogSettings.sellWhenOutOfStock })
    .from(catalogSettings)
    .limit(1);
  return row ?? DEFAULT_CATALOG_SETTINGS;
}

export const productsDb: ProductsSource = {
  getProducts: async (filters: ProductFilters = {}) => {
    const [rows, settings] = await Promise.all([
      getDb().select().from(products),
      readCatalogSettings(),
    ]);
    return sortProductsByName(
      filterProducts(rows.map(toProduct), filters, settings),
    );
  },

  getCatalogSettings: readCatalogSettings,

  // Une seule ligne : insérée si absente, sinon mise à jour.
  updateCatalogSettings: async (settings: CatalogSettings) => {
    const [row] = await getDb()
      .insert(catalogSettings)
      .values({ id: "catalog", ...settings })
      .onConflictDoUpdate({
        target: catalogSettings.id,
        set: {
          sellWhenOutOfStock: settings.sellWhenOutOfStock,
          updatedAt: new Date(),
        },
      })
      .returning({ sellWhenOutOfStock: catalogSettings.sellWhenOutOfStock });
    if (!row) throw new Error("Paramètres du catalogue non enregistrés.");
    return row;
  },

  getProduct: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return row ? toProduct(row) : null;
  },

  createProduct: async (input: ProductInput) => {
    const [row] = await getDb()
      .insert(products)
      .values({ id: randomUUID(), ...productToRow(input) })
      .returning();
    if (!row) throw new Error("Insertion du produit sans ligne renvoyée.");
    return toProduct(row);
  },

  updateProduct: async (id: string, input: ProductInput) => {
    const [row] = await getDb()
      .update(products)
      .set({ ...productToRow(input), updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return row ? toProduct(row) : null;
  },

  deleteProduct: async (id: string) => {
    const deleted = await getDb()
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    return deleted.length > 0;
  },
};
