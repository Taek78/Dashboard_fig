import type {
  Product,
  ProductFilters,
  ProductPatch,
} from "@/domain/products/types";

/*
 * CONTRAT du catalogue : mock aujourd'hui (src/data/products.mock.ts), Drizzle en
 * B3. Types seulement. updateProduct renvoie null si le produit n'existe pas.
 */
export type ProductsSource = {
  getProducts(filters?: ProductFilters): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  updateProduct(id: string, patch: ProductPatch): Promise<Product | null>;
};
