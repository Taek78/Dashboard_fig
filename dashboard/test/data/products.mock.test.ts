import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_UPDATED_AT,
  PRODUCTS_MOCK_LATENCY_MS,
  productsMock,
  resetProductsMock,
} from "@/data/products.mock";
import { productsFixtures } from "@/domain/products/fixtures";
import type { ProductInput } from "@/domain/products/types";

beforeEach(() => {
  vi.useFakeTimers();
  resetProductsMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(PRODUCTS_MOCK_LATENCY_MS);
  return promise;
}

const input: ProductInput = {
  name: "Poires",
  variety: "Conférence",
  category: "fruit",
  unit: "g",
  priceCents: 320,
  unitWeightGrams: null,
  container: "tray",
  originCountry: "FR",
  originRegion: "Savoie",
  caliber: { minMm: 60, maxMm: 70 },
  organic: false,
  inSeason: true,
  available: true,
  visible: true,
  stockQuantity: 5000,
  illustration: "🍐",
  imageUrl: null,
};

describe("productsMock", () => {
  it("getProducts renvoie les visibles triés par nom, et filtre", async () => {
    const all = await settle(productsMock.getProducts());
    expect(all).toHaveLength(15);
    expect(all[0]?.name).toBe("Avocat");
    const fruits = await settle(
      productsMock.getProducts({ category: "fruit" }),
    );
    expect(fruits.every((p) => p.category === "fruit")).toBe(true);
  });

  it("getProduct trouve (même masqué) ou renvoie null", async () => {
    expect((await settle(productsMock.getProduct("prd-0016")))?.name).toBe(
      "Poivron",
    );
    expect(await settle(productsMock.getProduct("prd-9999"))).toBeNull();
  });

  it("createProduct attribue un id et updatedAt, visible ensuite dans la liste", async () => {
    const created = await settle(productsMock.createProduct(input));
    expect(created.id).toBe("prd-m-1");
    expect(created.updatedAt).toBe(MOCK_UPDATED_AT);
    const all = await settle(productsMock.getProducts());
    expect(all.some((p) => p.id === "prd-m-1" && p.name === "Poires")).toBe(
      true,
    );
    expect(productsFixtures).toHaveLength(16);
  });

  it("updateProduct remplace toute la fiche, garde l'id, ou renvoie null", async () => {
    const updated = await settle(
      productsMock.updateProduct("prd-0003", {
        ...input,
        name: "Bananes",
        visible: false,
      }),
    );
    expect(updated).toMatchObject({
      id: "prd-0003",
      name: "Bananes",
      visible: false,
      updatedAt: MOCK_UPDATED_AT,
    });
    const again = await settle(productsMock.getProduct("prd-0003"));
    expect(again?.originRegion).toBe("Savoie");
    expect(
      productsFixtures.find((p) => p.id === "prd-0003")?.originRegion,
    ).toBeNull();
    expect(
      await settle(productsMock.updateProduct("prd-9999", input)),
    ).toBeNull();
  });

  it("deleteProduct retire le produit et dit s'il existait", async () => {
    expect(await settle(productsMock.deleteProduct("prd-0003"))).toBe(true);
    expect(await settle(productsMock.getProduct("prd-0003"))).toBeNull();
    expect(await settle(productsMock.deleteProduct("prd-0003"))).toBe(false);
    resetProductsMock();
    expect((await settle(productsMock.getProduct("prd-0003")))?.name).toBe(
      "Bananes",
    );
  });
});
