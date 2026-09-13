import { describe, expect, it } from "vitest";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  CONTAINERS,
  ILLUSTRATIONS,
  ORIGIN_COUNTRIES,
  PRODUCT_CATEGORIES,
} from "@/domain/products/category";
import { productsFixtures } from "@/domain/products/fixtures";

describe("productsFixtures", () => {
  it("couvrent exactement les produits des lignes de commande, avec les mêmes unités", () => {
    const fromOrders = new Map<string, string>();
    for (const order of ordersFixtures) {
      for (const line of order.lines) fromOrders.set(line.productId, line.unit);
    }
    expect(new Set(productsFixtures.map((p) => p.id))).toEqual(
      new Set(fromOrders.keys()),
    );
    for (const p of productsFixtures) expect(fromOrders.get(p.id)).toBe(p.unit);
  });

  it("ont des valeurs dans les vocabulaires, un prix positif entier, un calibre cohérent", () => {
    for (const p of productsFixtures) {
      expect(Number.isInteger(p.priceCents) && p.priceCents > 0).toBe(true);
      expect(PRODUCT_CATEGORIES).toContain(p.category);
      expect(CONTAINERS).toContain(p.container);
      expect(Object.keys(ORIGIN_COUNTRIES)).toContain(p.originCountry);
      expect(ILLUSTRATIONS).toContain(p.illustration);
      expect(p.stockQuantity).toBeGreaterThanOrEqual(0);
      if (p.caliber)
        expect(p.caliber.minMm).toBeLessThanOrEqual(p.caliber.maxMm);
      if (p.unit === "g") expect(p.unitWeightGrams).toBeNull();
      else expect(p.unitWeightGrams).toBeGreaterThan(0);
    }
  });

  it("ont des prix cohérents avec les totaux de ligne des commandes", () => {
    const byId = new Map(productsFixtures.map((p) => [p.id, p]));
    for (const order of ordersFixtures) {
      for (const line of order.lines) {
        const p = byId.get(line.productId)!;
        const expected =
          p.unit === "g"
            ? Math.round((p.priceCents * line.quantity) / 1000)
            : p.priceCents * line.quantity;
        expect(line.lineTotalCents).toBe(expected);
      }
    }
  });

  it("contiennent au moins un produit masqué, un indisponible, un bio et un hors saison", () => {
    expect(productsFixtures.some((p) => !p.visible)).toBe(true);
    expect(productsFixtures.some((p) => !p.available)).toBe(true);
    expect(productsFixtures.some((p) => p.organic)).toBe(true);
    expect(productsFixtures.some((p) => !p.inSeason)).toBe(true);
  });
});
