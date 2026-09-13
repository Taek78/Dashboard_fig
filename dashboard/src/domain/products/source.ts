import type {
  Product,
  ProductFilters,
  ProductInput,
} from "@/domain/products/types";

/*
 * CONTRAT du catalogue : mock aujourd'hui (src/data/products.mock.ts), Drizzle en
 * B3. Types seulement. updateProduct et deleteProduct renvoient null / false si
 * le produit n'existe pas ; createProduct attribue l'id et updatedAt.
 */
export type ProductsSource = {
  getProducts(filters?: ProductFilters): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: ProductInput): Promise<Product | null>;
  deleteProduct(id: string): Promise<boolean>;
};
