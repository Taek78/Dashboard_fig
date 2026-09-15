import { describe, expect, it } from "vitest";
import { pieSlicePaths } from "@/lib/pie";

describe("pieSlicePaths", () => {
  it("ne dessine rien sans valeur positive", () => {
    expect(pieSlicePaths([], 10)).toEqual([]);
    expect(pieSlicePaths([0, 0], 10)).toEqual([]);
    expect(pieSlicePaths([-3], 10)).toEqual([]);
  });

  it("une seule valeur non nulle : le disque entier", () => {
    const [slice] = pieSlicePaths([0, 7], 10);
    expect(slice?.index).toBe(1);
    expect(slice?.path).toBe("M 10 0 A 10 10 0 1 1 10 20 A 10 10 0 1 1 10 0 Z");
  });

  it("deux moitiés : du haut vers le bas, puis retour au haut", () => {
    const slices = pieSlicePaths([1, 1], 10);
    expect(slices.map((s) => s.path)).toEqual([
      "M 10 10 L 10 0 A 10 10 0 0 1 10 20 Z",
      "M 10 10 L 10 20 A 10 10 0 0 1 10 0 Z",
    ]);
  });

  it("une part de plus de la moitié prend le grand arc ; les parts nulles sont sautées", () => {
    const slices = pieSlicePaths([3, 0, 1], 10);
    expect(slices.map((s) => s.index)).toEqual([0, 2]);
    expect(slices[0]?.path).toContain("A 10 10 0 1 1");
    expect(slices[1]?.path).toContain("A 10 10 0 0 1");
  });
});
