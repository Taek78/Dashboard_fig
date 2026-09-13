import "server-only";
import { selectSource } from "@/data/select-source";
import type { ProductsSource } from "@/domain/products/source";
import { productsMock } from "@/data/products.mock";

/* FAÇADE du catalogue : seul module importé par le front. Une ligne change en B3. */
// B1 : choix par DATA_SOURCE. La version Drizzle (B3) remplacera le null.
const source: ProductsSource = selectSource("catalogue", productsMock, null);

export const getProducts: ProductsSource["getProducts"] = (filters) =>
  source.getProducts(filters);
export const getProduct: ProductsSource["getProduct"] = (id) =>
  source.getProduct(id);
export const updateProduct: ProductsSource["updateProduct"] = (id, patch) =>
  source.updateProduct(id, patch);
