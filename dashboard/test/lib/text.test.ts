import { describe, expect, it } from "vitest";
import { digitsOnly, initials, normalize } from "@/lib/text";

describe("normalize", () => {
  it("retire accents, ligatures, majuscules et espaces autour", () => {
    expect(normalize("  Pêche Blanche ")).toBe("peche blanche");
    expect(normalize("Tomates cœur de bœuf")).toBe("tomates coeur de boeuf");
    expect(normalize("Élise")).toBe("elise");
  });
});

describe("digitsOnly", () => {
  it("ne garde que les chiffres", () => {
    expect(digitsOnly("06 39 98 00 01")).toBe("0639980001");
    expect(digitsOnly("+33 (0)6")).toBe("3306");
  });
});

describe("initials", () => {
  it("prend la première lettre du premier et du dernier mot", () => {
    expect(initials("Zaki Affane")).toBe("ZA");
    expect(initials("Marie-Claire de la Tour")).toBe("MT");
  });

  it("un seul mot donne une lettre, un nom vide donne ?", () => {
    expect(initials("admin")).toBe("A");
    expect(initials("   ")).toBe("?");
  });
});
