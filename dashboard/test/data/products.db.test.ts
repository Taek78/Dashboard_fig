import { describe, expect, it, vi } from "vitest";
import { productsFixtures } from "@/domain/products/fixtures";
import type { ProductInput } from "@/domain/products/types";

/* Catalogue sur la base de test, chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { productsDb } = await import("@/data/products.db");

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

describe("productsDb", () => {
  it("getProducts renvoie les visibles triés par nom, et filtre", async () => {
    const all = await productsDb.getProducts();
    expect(all).toHaveLength(productsFixtures.filter((p) => p.visible).length);
    expect(all[0]?.name).toBe("Avocat");
    const fruits = await productsDb.getProducts({ category: "fruit" });
    expect(fruits.length).toBeGreaterThan(0);
    expect(fruits.every((p) => p.category === "fruit")).toBe(true);
  });

  it("getProduct trouve (même masqué) ou renvoie null", async () => {
    expect((await productsDb.getProduct("prd-0016"))?.name).toBe("Poivron");
    expect(await productsDb.getProduct("prd-9999")).toBeNull();
  });

  it("createProduct attribue un id et une date, visible ensuite dans la liste", async () => {
    const created = await productsDb.createProduct(input);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({
      name: "Poires",
      caliber: { minMm: 60, maxMm: 70 },
    });
    expect(
      (await productsDb.getProducts()).some((p) => p.id === created.id),
    ).toBe(true);
  });

  it("updateProduct remplace toute la fiche en gardant l'id, ou renvoie null", async () => {
    const updated = await productsDb.updateProduct("prd-0003", {
      ...input,
      name: "Bananes",
      visible: false,
    });
    expect(updated).toMatchObject({
      id: "prd-0003",
      name: "Bananes",
      visible: false,
      originRegion: "Savoie",
    });
    expect(await productsDb.updateProduct("prd-9999", input)).toBeNull();
  });

  it("deleteProduct retire le produit et dit s'il existait", async () => {
    expect(await productsDb.deleteProduct("prd-0003")).toBe(true);
    expect(await productsDb.getProduct("prd-0003")).toBeNull();
    expect(await productsDb.deleteProduct("prd-0003")).toBe(false);
  });

  it("paramètres du catalogue : non par défaut, enregistrés, appliqués au filtre", async () => {
    expect(await productsDb.getCatalogSettings()).toEqual({
      sellWhenOutOfStock: false,
    });
    const unavailable = () =>
      productsDb
        .getProducts({ availability: "unavailable" })
        .then((list) => list.map((p) => p.id));
    expect(await unavailable()).toContain("prd-0013");

    expect(
      await productsDb.updateCatalogSettings({ sellWhenOutOfStock: true }),
    ).toEqual({ sellWhenOutOfStock: true });
    expect(await productsDb.getCatalogSettings()).toEqual({
      sellWhenOutOfStock: true,
    });
    expect(await unavailable()).not.toContain("prd-0013");
  });
});
