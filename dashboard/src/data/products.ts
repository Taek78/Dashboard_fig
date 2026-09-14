import "server-only";
import { selectSource } from "@/data/select-source";
import type { ProductsSource } from "@/domain/products/source";
import { productsDb } from "@/data/products.db";
import { productsMock } from "@/data/products.mock";

/* FAÇADE du catalogue : seul module importé par le front ; DATA_SOURCE choisit fixtures ou Postgres. */
const source = (): ProductsSource =>
  selectSource("catalogue", productsMock, productsDb);

export const getProducts: ProductsSource["getProducts"] = (filters) =>
  source().getProducts(filters);
export const getProduct: ProductsSource["getProduct"] = (id) =>
  source().getProduct(id);
export const createProduct: ProductsSource["createProduct"] = (input) =>
  source().createProduct(input);
export const updateProduct: ProductsSource["updateProduct"] = (id, input) =>
  source().updateProduct(id, input);
export const deleteProduct: ProductsSource["deleteProduct"] = (id) =>
  source().deleteProduct(id);
