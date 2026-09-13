import { describe, expect, it } from "vitest";
import { productsFixtures } from "@/domain/products/fixtures";
import {
  centsToEurosInput,
  eurosToCents,
  filterProducts,
  formatCaliber,
  isLowStock,
  pricePerKgCents,
  sortProductsByName,
  unitPriceCents,
} from "@/domain/products/rules";
import { normalize } from "@/lib/text";

describe("eurosToCents", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["0,60", 60],
    [" 3,5 € ", 350],
    ["1 250,00", 125000],
  ])("%s → %d", (input, expected) => {
    expect(eurosToCents(input)).toBe(expected);
  });

  it("refuse le vide, le négatif, zéro, trois décimales et le texte", () => {
    for (const bad of ["", "-3", "0", "0,00", "3,505", "abc", "3,5,0", "1e3"]) {
      expect(eurosToCents(bad)).toBeNull();
    }
  });

  it("ne produit jamais de flottant : 0,29 → 29 exactement", () => {
    expect(eurosToCents("0,29")).toBe(29);
    expect(eurosToCents("1,15")).toBe(115);
  });
});

describe("centsToEurosInput", () => {
  it("formate avec virgule et deux décimales, aller-retour exact", () => {
    expect(centsToEurosInput(1250)).toBe("12,50");
    expect(centsToEurosInput(60)).toBe("0,60");
    for (const cents of [1, 29, 100, 1250, 99999]) {
      expect(eurosToCents(centsToEurosInput(cents))).toBe(cents);
    }
  });
});

describe("prix unitaire et prix au kilo", () => {
  it("au poids : prix au kilo = prix, pas de prix unitaire", () => {
    const p = { unit: "g" as const, priceCents: 290, unitWeightGrams: null };
    expect(pricePerKgCents(p)).toBe(290);
    expect(unitPriceCents(p)).toBeNull();
  });

  it("à la pièce : prix unitaire = prix, prix au kilo déduit du poids moyen", () => {
    const p = { unit: "piece" as const, priceCents: 180, unitWeightGrams: 180 };
    expect(unitPriceCents(p)).toBe(180);
    expect(pricePerKgCents(p)).toBe(1000);
    expect(pricePerKgCents({ ...p, unitWeightGrams: 350 })).toBe(514);
  });

  it("à la pièce sans poids connu : prix au kilo inconnu", () => {
    expect(
      pricePerKgCents({
        unit: "piece",
        priceCents: 180,
        unitWeightGrams: null,
      }),
    ).toBeNull();
    expect(
      pricePerKgCents({ unit: "piece", priceCents: 180, unitWeightGrams: 0 }),
    ).toBeNull();
  });
});

describe("formatCaliber", () => {
  it("écrit la fourchette, ou la valeur seule, ou rien", () => {
    expect(formatCaliber({ minMm: 70, maxMm: 80 })).toBe("70–80 mm");
    expect(formatCaliber({ minMm: 60, maxMm: 60 })).toBe("60 mm");
    expect(formatCaliber(null)).toBeNull();
  });
});

describe("filterProducts", () => {
  it("masque les produits non visibles par défaut, les inclut sur demande", () => {
    expect(filterProducts(productsFixtures, {})).toHaveLength(15);
    expect(
      filterProducts(productsFixtures, { includeHidden: true }),
    ).toHaveLength(16);
  });

  it("recherche sur le nom ET la variété, sans accents", () => {
    expect(
      filterProducts(productsFixtures, { query: "coeur" }).map((p) => p.name),
    ).toEqual(["Tomates"]);
    expect(
      filterProducts(productsFixtures, { query: "gala" }).map((p) => p.name),
    ).toEqual(["Pommes"]);
    expect(normalize("Cœur")).toBe("coeur");
  });

  it("filtre par catégorie et disponibilité, critères cumulés", () => {
    expect(
      filterProducts(productsFixtures, { category: "fruit" }).every(
        (p) => p.category === "fruit",
      ),
    ).toBe(true);
    expect(
      filterProducts(productsFixtures, { availability: "unavailable" }).map(
        (p) => p.id,
      ),
    ).toEqual(["prd-0009"]);
    expect(
      filterProducts(productsFixtures, {
        availability: "unavailable",
        includeHidden: true,
      }).map((p) => p.id),
    ).toEqual(["prd-0009", "prd-0016"]);
  });
});

describe("sortProductsByName", () => {
  it("trie en ordre français sans muter l'entrée", () => {
    const sorted = sortProductsByName(productsFixtures);
    expect(sorted[0]?.name).toBe("Avocat");
    expect(sorted.at(-1)?.name).toBe("Tomates");
    expect(productsFixtures[0]?.name).toBe("Carottes");
  });
});

describe("isLowStock", () => {
  it("sous 2 kg ou sous 10 pièces", () => {
    expect(isLowStock({ unit: "g", stockQuantity: 1999 })).toBe(true);
    expect(isLowStock({ unit: "g", stockQuantity: 2000 })).toBe(false);
    expect(isLowStock({ unit: "piece", stockQuantity: 9 })).toBe(true);
    expect(isLowStock({ unit: "piece", stockQuantity: 10 })).toBe(false);
  });
});
