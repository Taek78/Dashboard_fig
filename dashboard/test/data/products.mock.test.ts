import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_UPDATED_AT,
  PRODUCTS_MOCK_LATENCY_MS,
  productsMock,
  resetProductsMock,
} from "@/data/products.mock";
import { productsFixtures } from "@/domain/products/fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  resetProductsMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(PRODUCTS_MOCK_LATENCY_MS);
  return promise;
}

describe("productsMock", () => {
  it("getProducts renvoie tout trié par nom, et filtre", async () => {
    const all = await settle(productsMock.getProducts());
    expect(all).toHaveLength(16);
    expect(all[0]?.name).toBe("Avocat");
    const fruits = await settle(
      productsMock.getProducts({ category: "fruits" }),
    );
    expect(fruits.every((p) => p.category === "fruits")).toBe(true);
  });

  it("getProduct trouve ou renvoie null", async () => {
    expect((await settle(productsMock.getProduct("prd-0003")))?.name).toBe(
      "Bananes",
    );
    expect(await settle(productsMock.getProduct("prd-9999"))).toBeNull();
  });

  it("updateProduct écrit prix, disponibilité, stock et updatedAt, visible ensuite", async () => {
    const updated = await settle(
      productsMock.updateProduct("prd-0003", {
        priceCents: 275,
        available: false,
        stockQuantity: 0,
      }),
    );
    expect(updated).toMatchObject({
      priceCents: 275,
      available: false,
      stockQuantity: 0,
      updatedAt: MOCK_UPDATED_AT,
    });
    const again = await settle(productsMock.getProduct("prd-0003"));
    expect(again?.priceCents).toBe(275);
    expect(productsFixtures.find((p) => p.id === "prd-0003")?.priceCents).toBe(
      250,
    );
  });

  it("updateProduct renvoie null pour un id inconnu", async () => {
    expect(
      await settle(
        productsMock.updateProduct("prd-9999", {
          priceCents: 1,
          available: true,
          stockQuantity: 1,
        }),
      ),
    ).toBeNull();
  });
});
