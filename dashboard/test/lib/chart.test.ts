import { describe, expect, it } from "vitest";
import { areaPath, monotonePath, niceTicks } from "@/lib/chart";

describe("niceTicks", () => {
  it("choisit un pas rond qui couvre le maximum", () => {
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0.9)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(7, 4, true)).toEqual([0, 2, 4, 6, 8]);
  });

  it("jamais de pas décimal pour un compte, un axe lisible sans données", () => {
    expect(niceTicks(3, 4, true)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(-5)).toEqual([0, 1]);
  });
});

/** Ordonnées de tous les nombres d'un tracé (x et y alternés après M, C, L). */
const ys = (path: string) =>
  (path.match(/-?\d+(\.\d+)?/g) ?? [])
    .map(Number)
    .filter((_, i) => i % 2 === 1);

describe("monotonePath / areaPath", () => {
  it("relie deux points par une courbe, un seul point par un déplacement", () => {
    expect(monotonePath([])).toBe("");
    expect(monotonePath([{ x: 10, y: 20 }])).toBe("M10,20");
    expect(
      monotonePath([
        { x: 0, y: 1000 },
        { x: 1000, y: 0 },
      ]),
    ).toBe("M0,1000C333.3,666.7,666.7,333.3,1000,0");
  });

  it("ne dépasse jamais les valeurs voisines (monotone)", () => {
    const path = monotonePath([
      { x: 0, y: 1000 },
      { x: 250, y: 0 },
      { x: 500, y: 0 },
      { x: 750, y: 900 },
      { x: 1000, y: 850 },
    ]);
    for (const y of ys(path)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1000);
    }
  });

  it("ferme la surface par la ligne de base", () => {
    expect(
      areaPath(
        [
          { x: 0, y: 500 },
          { x: 1000, y: 500 },
        ],
        1000,
      ),
    ).toBe("M0,500C333.3,500,666.7,500,1000,500L1000,1000L0,1000Z");
    expect(areaPath([], 1000)).toBe("");
  });
});
