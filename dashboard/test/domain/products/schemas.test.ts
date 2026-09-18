import { describe, expect, it } from "vitest";
import {
  deleteProductSchema,
  parseProductFilters,
  productInputSchema,
} from "@/domain/products/schemas";

describe("parseProductFilters", () => {
  it("traduit les clés d'URL et ignore l'invalide", () => {
    expect(parseProductFilters({})).toEqual({
      category: undefined,
      query: undefined,
      availability: undefined,
      includeHidden: undefined,
    });
    expect(
      parseProductFilters({
        categorie: "fruit",
        q: " pom ",
        dispo: "oui",
        masques: "1",
      }),
    ).toEqual({
      category: "fruit",
      query: "pom",
      availability: "available",
      includeHidden: true,
    });
    expect(parseProductFilters({ dispo: "non" }).availability).toBe(
      "unavailable",
    );
    expect(
      parseProductFilters({
        categorie: "viande",
        dispo: "peut-etre",
        q: "",
        masques: "oui",
      }),
    ).toEqual({
      category: undefined,
      query: undefined,
      availability: undefined,
      includeHidden: undefined,
    });
  });
});

const valid = {
  name: " Pommes ",
  variety: "Gala",
  category: "fruit",
  unit: "g",
  priceEuros: "3,50",
  unitWeightGrams: "",
  container: "tray",
  originCountry: "FR",
  originRegion: "Val de Loire",
  caliberMin: "70",
  caliberMax: "80",
  organic: "on",
  inSeason: "on",
  available: "on",
  visible: "on",
  stockQuantity: "18000",
  illustration: "🍎",
  imageUrl: "",
};

describe("productInputSchema", () => {
  it("produit un ProductInput complet : centimes, calibre, cases, nulls", () => {
    const r = productInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        name: "Pommes",
        variety: "Gala",
        category: "fruit",
        unit: "g",
        priceCents: 350,
        unitWeightGrams: null,
        container: "tray",
        originCountry: "FR",
        originRegion: "Val de Loire",
        caliber: { minMm: 70, maxMm: 80 },
        organic: true,
        inSeason: true,
        available: true,
        visible: true,
        stockQuantity: 18000,
        illustration: "🍎",
        imageUrl: null,
      });
    }
  });

  it("cases absentes = false, textes vides = null, calibre absent = null", () => {
    const withoutBoxes = Object.fromEntries(
      Object.entries(valid).filter(
        ([k]) => !["organic", "inSeason", "available", "visible"].includes(k),
      ),
    );
    const r = productInputSchema.safeParse({
      ...withoutBoxes,
      variety: "  ",
      originRegion: "",
      caliberMin: "",
      caliberMax: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        organic: false,
        inSeason: false,
        available: false,
        visible: false,
        variety: null,
        originRegion: null,
        caliber: null,
      });
    }
  });

  it("garde le poids moyen seulement pour une pièce", () => {
    const piece = productInputSchema.safeParse({
      ...valid,
      unit: "piece",
      unitWeightGrams: "180",
    });
    expect(piece.success && piece.data.unitWeightGrams).toBe(180);
    const weight = productInputSchema.safeParse({
      ...valid,
      unit: "g",
      unitWeightGrams: "180",
    });
    expect(weight.success && weight.data.unitWeightGrams).toBeNull();
  });

  it("refuse un calibre incomplet ou inversé", () => {
    expect(
      productInputSchema.safeParse({ ...valid, caliberMax: "" }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ ...valid, caliberMin: "90" }).success,
    ).toBe(false);
  });

  it("refuse prix invalide, nom vide, vocabulaire inconnu, URL non https, stock non entier", () => {
    for (const bad of [
      { priceEuros: "gratuit" },
      { priceEuros: "0" },
      { name: "  " },
      { category: "herbe" },
      { originCountry: "US" },
      { container: "boite" },
      { illustration: "🍔" },
      { imageUrl: "http://exemple.invalid/a.jpg" },
      { imageUrl: "pas une url" },
      { stockQuantity: "-1" },
      { stockQuantity: "1,5" },
    ]) {
      expect(productInputSchema.safeParse({ ...valid, ...bad }).success).toBe(
        false,
      );
    }
    expect(
      productInputSchema.safeParse({
        ...valid,
        imageUrl: "https://exemple.invalid/a.jpg",
      }).success,
    ).toBe(true);
  });
});

describe("deleteProductSchema", () => {
  it("exige l'id et la confirmation de la fenêtre (confirm=oui)", () => {
    expect(
      deleteProductSchema.safeParse({
        productId: "prd-0001",
        confirm: "oui",
      }).success,
    ).toBe(true);
    // L'ancien mot à taper ne vaut plus confirmation.
    expect(
      deleteProductSchema.safeParse({
        productId: "prd-0001",
        confirm: "SUPPRIMER",
      }).success,
    ).toBe(false);
    expect(
      deleteProductSchema.safeParse({ productId: "prd-0001" }).success,
    ).toBe(false);
  });
});
