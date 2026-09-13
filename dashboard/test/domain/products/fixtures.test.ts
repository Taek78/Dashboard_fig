import { describe, expect, it } from "vitest";
import { ordersFixtures } from "@/domain/orders/fixtures";
import { PRODUCT_CATEGORIES } from "@/domain/products/category";
import { productsFixtures } from "@/domain/products/fixtures";

describe("productsFixtures", () => {
  it("couvrent exactement les produits des lignes de commande, avec les mêmes noms et unités", () => {
    const fromOrders = new Map<string, { name: string; unit: string }>();
    for (const order of ordersFixtures) {
      for (const line of order.lines) {
        fromOrders.set(line.productId, {
          name: line.productName,
          unit: line.unit,
        });
      }
    }
    expect(new Set(productsFixtures.map((p) => p.id))).toEqual(
      new Set(fromOrders.keys()),
    );
    for (const p of productsFixtures) {
      expect(fromOrders.get(p.id)).toEqual({ name: p.name, unit: p.unit });
    }
  });

  it("ont un prix strictement positif en centimes entiers et une catégorie connue", () => {
    for (const p of productsFixtures) {
      expect(Number.isInteger(p.priceCents) && p.priceCents > 0).toBe(true);
      expect(PRODUCT_CATEGORIES).toContain(p.category);
      expect(p.stockQuantity).toBeGreaterThanOrEqual(0);
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
});
