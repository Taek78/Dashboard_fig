import "server-only";
import { productsDb } from "@/data/products.db";
import type { ProductsSource } from "@/domain/products/source";

/*
 * FAÇADE du catalogue : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (products.db.ts) ; la façade fixe le contrat
 * ProductsSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
}: ProductsSource = productsDb;
