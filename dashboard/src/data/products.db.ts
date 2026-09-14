import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productToRow, toProduct } from "@/db/mappers";
import { products } from "@/db/schema";
import { filterProducts, sortProductsByName } from "@/domain/products/rules";
import type { ProductsSource } from "@/domain/products/source";
import type { ProductFilters, ProductInput } from "@/domain/products/types";

/*
 * Implémentation Drizzle du contrat ProductsSource. Le catalogue est petit
 * (quelques dizaines de références) : on charge tout puis on applique les mêmes
 * règles pures que le mock (recherche sans accents, tri français), plutôt que
 * de réécrire la normalisation en SQL. À revoir si le catalogue dépasse
 * quelques milliers de lignes (extension pg_trgm ou unaccent).
 */
export const productsDb: ProductsSource = {
  getProducts: async (filters: ProductFilters = {}) => {
    const rows = await getDb().select().from(products);
    return sortProductsByName(filterProducts(rows.map(toProduct), filters));
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
