import { productsFixtures } from "@/domain/products/fixtures";
import { filterProducts, sortProductsByName } from "@/domain/products/rules";
import type { ProductsSource } from "@/domain/products/source";
import type {
  Product,
  ProductFilters,
  ProductInput,
} from "@/domain/products/types";

/*
 * Implémentation FIXTURES du contrat ProductsSource : Map mutable seedée, clone à
 * l'entrée et à la sortie, latence simulée, resetProductsMock() hors contrat.
 * `updatedAt` reçoit une valeur fixe et non new Date() pour rester déterministe
 * sous Vitest ; la vraie base mettra un timestamp (B3). Les ids créés sont un
 * compteur local ("prd-m-1"…) : la vraie base en générera.
 */
const store = new Map<string, Product>();
let counter = 0;

function seed(): void {
  store.clear();
  counter = 0;
  for (const p of productsFixtures) store.set(p.id, structuredClone(p));
}

seed();

export const PRODUCTS_MOCK_LATENCY_MS = 300;
export const MOCK_UPDATED_AT = "2026-09-13T12:00:00.000Z";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const productsMock: ProductsSource = {
  getProducts: async (filters: ProductFilters = {}) => {
    await sleep(PRODUCTS_MOCK_LATENCY_MS);
    const result = sortProductsByName(
      filterProducts([...store.values()], filters),
    );
    return structuredClone(result);
  },

  getProduct: async (id: string) => {
    await sleep(PRODUCTS_MOCK_LATENCY_MS);
    const product = store.get(id);
    return product ? structuredClone(product) : null;
  },

  createProduct: async (input: ProductInput) => {
    await sleep(PRODUCTS_MOCK_LATENCY_MS);
    counter += 1;
    const created: Product = {
      ...structuredClone(input),
      id: `prd-m-${counter}`,
      updatedAt: MOCK_UPDATED_AT,
    };
    store.set(created.id, created);
    return structuredClone(created);
  },

  updateProduct: async (id: string, input: ProductInput) => {
    await sleep(PRODUCTS_MOCK_LATENCY_MS);
    const current = store.get(id);
    if (!current) return null;
    const updated: Product = {
      ...structuredClone(input),
      id: current.id,
      updatedAt: MOCK_UPDATED_AT,
    };
    store.set(id, updated);
    return structuredClone(updated);
  },

  deleteProduct: async (id: string) => {
    await sleep(PRODUCTS_MOCK_LATENCY_MS);
    return store.delete(id);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement. */
export function resetProductsMock(): void {
  seed();
}
