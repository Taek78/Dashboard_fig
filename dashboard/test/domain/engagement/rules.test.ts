import { describe, expect, it } from "vitest";
import { engagementFixtures } from "@/domain/engagement/fixtures";
import {
  monthsInRange,
  ratioPercent,
  summarizeEngagement,
} from "@/domain/engagement/rules";

describe("engagementFixtures", () => {
  it("couvrent janvier 2024 → septembre 2026 sans trou, valeurs positives et note ≤ 5", () => {
    expect(engagementFixtures[0]?.month).toBe("2024-01");
    expect(engagementFixtures.at(-1)?.month).toBe("2026-09");
    expect(engagementFixtures).toHaveLength(33);
    for (const p of engagementFixtures) {
      expect(p.downloads).toBeGreaterThan(0);
      expect(p.signups).toBeLessThanOrEqual(p.downloads);
      expect(p.rating).not.toBeNull();
      expect(p.rating!).toBeLessThanOrEqual(5);
    }
  });

  it("sont déterministes : deux lectures donnent la même chose", () => {
    expect(engagementFixtures[5]).toEqual(engagementFixtures[5]);
    expect(engagementFixtures[5]?.downloads).toBe(
      Math.round((160 + 5 * 9) * 1.25),
    );
  });
});

describe("monthsInRange", () => {
  it("liste les mois couverts, même partiellement, avec passage d'année", () => {
    expect(monthsInRange({ from: "2025-11-15", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(monthsInRange({ from: "2026-09-13", to: "2026-09-13" })).toEqual([
      "2026-09",
    ]);
  });
});

describe("summarizeEngagement", () => {
  it("somme les compteurs et pondère la note par le nombre d'avis", () => {
    const points = [
      {
        month: "2026-01",
        downloads: 100,
        signups: 30,
        rating: 4,
        ratingCount: 10,
      },
      {
        month: "2026-02",
        downloads: 200,
        signups: 80,
        rating: 5,
        ratingCount: 30,
      },
      {
        month: "2026-03",
        downloads: 999,
        signups: 999,
        rating: 1,
        ratingCount: 99,
      },
    ];
    const s = summarizeEngagement(points, {
      from: "2026-01-01",
      to: "2026-02-28",
    });
    expect(s).toEqual({
      downloads: 300,
      signups: 110,
      rating: 4.75,
      ratingCount: 40,
    });
  });

  it("sans avis ni mois : note null, zéros", () => {
    expect(
      summarizeEngagement(engagementFixtures, {
        from: "2020-01-01",
        to: "2020-12-31",
      }),
    ).toEqual({
      downloads: 0,
      signups: 0,
      rating: null,
      ratingCount: 0,
    });
  });

  it("l'année 2026 des fixtures compte 9 mois", () => {
    const s = summarizeEngagement(engagementFixtures, {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    const expected = engagementFixtures
      .filter((p) => p.month.startsWith("2026"))
      .reduce((sum, p) => sum + p.downloads, 0);
    expect(s.downloads).toBe(expected);
  });
});

describe("ratioPercent", () => {
  it("pourcentage arrondi, null sans total", () => {
    expect(ratioPercent(30, 100)).toBe(30);
    expect(ratioPercent(1, 3)).toBe(33);
    expect(ratioPercent(5, 0)).toBeNull();
  });
});
