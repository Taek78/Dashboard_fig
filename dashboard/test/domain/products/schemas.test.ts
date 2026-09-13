import { describe, expect, it } from "vitest";
import {
  parseProductFilters,
  updateProductSchema,
} from "@/domain/products/schemas";

describe("parseProductFilters", () => {
  it("traduit les clés d'URL et ignore l'invalide", () => {
    expect(parseProductFilters({})).toEqual({
      category: undefined,
      query: undefined,
      availability: undefined,
    });
    expect(
      parseProductFilters({ categorie: "fruits", q: " pom ", dispo: "oui" }),
    ).toEqual({
      category: "fruits",
      query: "pom",
      availability: "available",
    });
    expect(parseProductFilters({ dispo: "non" }).availability).toBe(
      "unavailable",
    );
    expect(
      parseProductFilters({ categorie: "viande", dispo: "peut-etre", q: "" }),
    ).toEqual({
      category: undefined,
      query: undefined,
      availability: undefined,
    });
  });
});

describe("updateProductSchema", () => {
  const valid = {
    productId: "prd-0001",
    priceEuros: "3,50",
    available: "on",
    stockQuantity: "12000",
  };

  it("convertit le prix en centimes, la case en booléen, le stock en nombre", () => {
    const r = updateProductSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        productId: "prd-0001",
        priceEuros: 350,
        available: true,
        stockQuantity: 12000,
      });
    }
  });

  it("case absente = indisponible", () => {
    const r = updateProductSchema.safeParse({
      productId: valid.productId,
      priceEuros: valid.priceEuros,
      stockQuantity: valid.stockQuantity,
    });
    expect(r.success && r.data.available).toBe(false);
  });

  it("refuse un prix invalide ou nul, un stock négatif ou décimal", () => {
    expect(
      updateProductSchema.safeParse({ ...valid, priceEuros: "0" }).success,
    ).toBe(false);
    expect(
      updateProductSchema.safeParse({ ...valid, priceEuros: "abc" }).success,
    ).toBe(false);
    expect(
      updateProductSchema.safeParse({ ...valid, stockQuantity: "-1" }).success,
    ).toBe(false);
    expect(
      updateProductSchema.safeParse({ ...valid, stockQuantity: "1,5" }).success,
    ).toBe(false);
    expect(
      updateProductSchema.safeParse({ ...valid, stockQuantity: "" }).success,
    ).toBe(false);
  });

  it("refuse une case cochée avec une autre valeur que on", () => {
    expect(
      updateProductSchema.safeParse({ ...valid, available: "true" }).success,
    ).toBe(false);
  });
});
