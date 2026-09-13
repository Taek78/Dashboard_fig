import { describe, expect, it } from "vitest";
import { productsFixtures } from "@/domain/products/fixtures";
import {
  centsToEurosInput,
  eurosToCents,
  filterProducts,
  isLowStock,
  sortProductsByName,
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
  it("formate avec virgule et deux décimales", () => {
    expect(centsToEurosInput(1250)).toBe("12,50");
    expect(centsToEurosInput(60)).toBe("0,60");
    expect(centsToEurosInput(700)).toBe("7,00");
  });

  it("fait l'aller-retour avec eurosToCents", () => {
    for (const cents of [1, 29, 100, 1250, 99999]) {
      expect(eurosToCents(centsToEurosInput(cents))).toBe(cents);
    }
  });
});

describe("normalize et filterProducts", () => {
  it("ignore accents et casse", () => {
    expect(normalize("  Pêche Blanche ")).toBe("peche blanche");
  });

  it("sans filtre, tout ; par recherche, sans accents ; par catégorie ; par disponibilité", () => {
    expect(filterProducts(productsFixtures, {})).toHaveLength(16);
    expect(
      filterProducts(productsFixtures, { query: "coeur" }).map((p) => p.name),
    ).toEqual(["Tomates cœur de bœuf"]);
    expect(
      filterProducts(productsFixtures, { category: "fruits" }).every(
        (p) => p.category === "fruits",
      ),
    ).toBe(true);
    expect(
      filterProducts(productsFixtures, { availability: "unavailable" }).map(
        (p) => p.id,
      ),
    ).toEqual(["prd-0009", "prd-0016"]);
  });

  it("cumule les critères", () => {
    expect(
      filterProducts(productsFixtures, {
        category: "vegetables",
        availability: "unavailable",
      }).map((p) => p.id),
    ).toEqual(["prd-0016"]);
  });
});

describe("sortProductsByName", () => {
  it("trie en ordre français sans muter l'entrée", () => {
    const sorted = sortProductsByName(productsFixtures);
    expect(sorted[0]?.name).toBe("Avocat");
    expect(sorted.at(-1)?.name).toBe("Tomates cœur de bœuf");
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
