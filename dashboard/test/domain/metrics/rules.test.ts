import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  applyTaxMode,
  bucketFor,
  applyTaxToValues,
  CHART_METRIC_KINDS,
  CHART_METRIC_LABELS,
  CHART_METRICS,
  compareSeries,
  computeKpis,
  computeTrend,
  daysBetween,
  DEFAULT_TAX_MODE,
  distinctBuyers,
  endOfMonth,
  filterByRange,
  METRIC_PERIODS,
  ordersByStatus,
  percentChange,
  periodRange,
  previousPeriodRange,
  previousYearRange,
  referenceRange,
  revenueSeries,
  seriesValue,
  startOfWeek,
  TAX_MODES,
  toExcludingTax,
  topProducts,
  communityShare,
} from "@/domain/metrics/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { filterOrders } from "@/domain/orders/rules";

/*
 * Les attendus sont recalculés ici de façon indépendante (boucles simples) sur les
 * fixtures : la page affiche exactement ces valeurs. TODAY est un dimanche.
 */
const TODAY = "2026-09-13";
const active = scenarioOrders.filter((o) => o.status !== "cancelled");
const expectedRevenue = active.reduce((s, o) => s + o.totalCents, 0);

describe("TVA", () => {
  it("déduit le HT du TTC à 5,5 %, arrondi au centime", () => {
    expect(toExcludingTax(1055)).toBe(1000);
    expect(toExcludingTax(290)).toBe(275);
    expect(applyTaxMode(1055, "ht")).toBe(1000);
    expect(applyTaxMode(1055, "ttc")).toBe(1055);
    expect(TAX_MODES[0]).toBe(DEFAULT_TAX_MODE);
    expect(DEFAULT_TAX_MODE).toBe("ht");
  });
});

describe("dates", () => {
  it("addDays, addMonths (fin de mois), endOfMonth, startOfWeek (lundi), daysBetween", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(startOfWeek("2026-09-13")).toBe("2026-09-07"); // dimanche → lundi
    expect(startOfWeek("2026-09-07")).toBe("2026-09-07");
    expect(daysBetween({ from: "2026-09-01", to: "2026-09-30" })).toBe(30);
  });
});

describe("periodRange", () => {
  it.each([
    ["aujourdhui", "2026-09-13", "2026-09-13"],
    ["hier", "2026-09-12", "2026-09-12"],
    ["semaine-derniere", "2026-08-31", "2026-09-06"],
    ["ce-mois", "2026-09-01", "2026-09-30"],
    ["mois-dernier", "2026-08-01", "2026-08-31"],
    ["90-jours", "2026-06-16", "2026-09-13"],
    ["6-mois", "2026-03-14", "2026-09-13"],
    ["cette-annee", "2026-01-01", "2026-12-31"],
    ["annee-derniere", "2025-01-01", "2025-12-31"],
    ["n-2", "2024-01-01", "2024-12-31"],
    ["n-3", "2023-01-01", "2023-12-31"],
  ] as const)("%s → %s .. %s", (period, from, to) => {
    expect(periodRange(period, TODAY)).toEqual({ from, to });
  });

  it("couvre toutes les périodes déclarées", () => {
    for (const p of METRIC_PERIODS) {
      const r = periodRange(p, TODAY);
      expect(r.from <= r.to).toBe(true);
    }
  });

  it("previousYearRange décale d'un an, 29 février compris", () => {
    expect(previousYearRange({ from: "2026-09-01", to: "2026-09-30" })).toEqual(
      {
        from: "2025-09-01",
        to: "2025-09-30",
      },
    );
    expect(previousYearRange({ from: "2024-02-29", to: "2024-02-29" })).toEqual(
      {
        from: "2023-02-28",
        to: "2023-02-28",
      },
    );
  });
});

describe("previousPeriodRange et referenceRange", () => {
  it("recule d'une longueur de plage, sans chevauchement", () => {
    expect(
      previousPeriodRange({ from: "2026-09-01", to: "2026-09-30" }),
    ).toEqual({
      from: "2026-08-02",
      to: "2026-08-31",
    });
    expect(
      previousPeriodRange({ from: "2026-09-13", to: "2026-09-13" }),
    ).toEqual({
      from: "2026-09-12",
      to: "2026-09-12",
    });
  });

  it("referenceRange choisit N-1 ou la période précédente", () => {
    const r = { from: "2026-09-01", to: "2026-09-30" };
    expect(referenceRange(r, "n-1")).toEqual(previousYearRange(r));
    expect(referenceRange(r, "precedente")).toEqual(previousPeriodRange(r));
  });
});

describe("distinctBuyers", () => {
  it("compte les clients distincts hors commandes annulées", () => {
    const expected = new Set(
      scenarioOrders
        .filter((o) => o.status !== "cancelled")
        .map((o) => o.customer.id),
    ).size;
    expect(distinctBuyers(scenarioOrders)).toBe(expected);
    expect(distinctBuyers([])).toBe(0);
  });
});

describe("filterByRange", () => {
  it("bornes incluses sur le jour de livraison", () => {
    expect(
      filterByRange(scenarioOrders, { from: "2026-09-07", to: "2026-09-08" }),
    ).toHaveLength(10);
    expect(
      filterByRange(scenarioOrders, { from: "2026-09-06", to: "2026-09-06" }),
    ).toHaveLength(4);
    expect(
      filterByRange(scenarioOrders, { from: "2025-09-01", to: "2025-09-30" }),
    ).toHaveLength(0);
  });
});

describe("computeKpis et percentChange", () => {
  it("calcule CA hors annulées, panier moyen, annulées, en attente", () => {
    const k = computeKpis(scenarioOrders);
    expect(k.orderCount).toBe(14);
    expect(k.cancelledCount).toBe(2);
    expect(k.preparingCount).toBe(7);
    expect(k.revenueCents).toBe(expectedRevenue);
    expect(k.averageBasketCents).toBe(Math.round(expectedRevenue / 12));
  });

  it("sans commande : zéros ; percentChange sans référence : null", () => {
    expect(computeKpis([]).averageBasketCents).toBe(0);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("computeTrend", () => {
  it("monte ou descend au-delà de la bande, avec le pourcentage arrondi", () => {
    expect(computeTrend(150, 100)).toEqual({ direction: "up", percent: 50 });
    expect(computeTrend(50, 100)).toEqual({ direction: "down", percent: -50 });
    expect(computeTrend(101, 100)).toEqual({ direction: "up", percent: 1 });
  });

  it("est plat dans la bande ±0,4 % ou quand l'arrondi donne 0, et quand rien n'est vendu", () => {
    expect(computeTrend(100, 100)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(1003, 1000)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(997, 1000)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(1004, 1000)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(0, 0)).toEqual({ direction: "flat", percent: 0 });
  });

  it("répond toujours : plat sans valeur, +100 % en partant de zéro", () => {
    expect(computeTrend(null, 10)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(10, null)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(10, 0)).toEqual({ direction: "up", percent: 100 });
  });
});

describe("séries", () => {
  it("bucketFor : jour ≤ 31 j, semaine ≤ 190 j, mois au-delà", () => {
    expect(bucketFor({ from: "2026-09-01", to: "2026-09-30" })).toBe("day");
    expect(bucketFor({ from: "2026-06-16", to: "2026-09-13" })).toBe("week");
    expect(bucketFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("revenueSeries couvre toute la plage, seaux vides compris, CA hors annulées", () => {
    const s = revenueSeries(
      scenarioOrders,
      { from: "2026-09-05", to: "2026-09-09" },
      "day",
    );
    expect(s.map((p) => p.key)).toEqual([
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
    ]);
    expect(s[0]?.orderCount).toBe(0);
    expect(s[3]?.orderCount).toBe(5);
    expect(s.reduce((sum, p) => sum + p.revenueCents, 0)).toBe(expectedRevenue);
  });

  it("revenueSeries par mois sur l'année : 12 seaux, septembre porte tout", () => {
    const s = revenueSeries(
      scenarioOrders,
      { from: "2026-01-01", to: "2026-12-31" },
      "month",
    );
    expect(s).toHaveLength(12);
    expect(s[8]?.key).toBe("2026-09-01");
    expect(s[8]?.revenueCents).toBe(expectedRevenue);
  });

  it("compareSeries aligne par position et met N-1 à zéro si absent", () => {
    const range = { from: "2026-09-06", to: "2026-09-08" };
    const c = compareSeries(
      revenueSeries(scenarioOrders, range, "day"),
      revenueSeries(scenarioOrders, previousYearRange(range), "day"),
    );
    expect(c).toHaveLength(3);
    expect(c[0]?.previousKey).toBe("2025-09-06");
    expect(c.every((p) => p.previous.revenueCents === 0)).toBe(true);
    expect(c.reduce((s, p) => s + p.current.revenueCents, 0)).toBe(
      expectedRevenue,
    );
  });

  it("chaque seau porte annulations, panier moyen et acheteurs distincts", () => {
    const [day7] = revenueSeries(
      scenarioOrders,
      { from: "2026-09-07", to: "2026-09-07" },
      "day",
    );
    const day = filterOrders(scenarioOrders, {
      from: "2026-09-07",
      to: "2026-09-07",
    });
    const active = day.filter((o) => o.status !== "cancelled");
    expect(day7?.orderCount).toBe(day.length);
    expect(day7?.cancelledCount).toBe(day.length - active.length);
    expect(day7?.buyers).toBe(new Set(active.map((o) => o.customer.id)).size);
    expect(day7?.averageBasketCents).toBe(
      Math.round(active.reduce((s, o) => s + o.totalCents, 0) / active.length),
    );
    const values = day7!;
    expect(seriesValue(values, "revenue")).toBe(values.revenueCents);
    expect(seriesValue(values, "orders")).toBe(values.orderCount);
    expect(seriesValue(values, "basket")).toBe(values.averageBasketCents);
    expect(seriesValue(values, "cancelled")).toBe(values.cancelledCount);
    expect(seriesValue(values, "buyers")).toBe(values.buyers);
  });

  it("applyTaxToValues ne touche que les montants", () => {
    const values = {
      revenueCents: 1055,
      orderCount: 3,
      cancelledCount: 1,
      averageBasketCents: 1055,
      buyers: 2,
    };
    expect(applyTaxToValues(values, "ht")).toEqual({
      ...values,
      revenueCents: 1000,
      averageBasketCents: 1000,
    });
    expect(applyTaxToValues(values, "ttc")).toEqual(values);
    for (const m of CHART_METRICS) {
      expect(CHART_METRIC_LABELS[m].length).toBeGreaterThan(0);
      expect(["money", "count"]).toContain(CHART_METRIC_KINDS[m]);
    }
  });
});

describe("ordersByStatus et topProducts", () => {
  it("une entrée par statut dans l'ordre du cycle", () => {
    expect(
      ordersByStatus(scenarioOrders).map((p) => [p.status, p.count]),
    ).toEqual([
      ["preparing", 7],
      ["delivering", 2],
      ["delivered", 3],
      ["cancelled", 2],
    ]);
  });

  it("topProducts classe par CA décroissant hors annulées", () => {
    const top = topProducts(scenarioOrders, 3);
    expect(top).toHaveLength(3);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i - 1]!.revenueCents).toBeGreaterThanOrEqual(
        top[i]!.revenueCents,
      );
    }
    const byProduct = new Map<string, number>();
    for (const o of active) {
      for (const l of o.lines) {
        byProduct.set(
          l.productId,
          (byProduct.get(l.productId) ?? 0) + l.lineTotalCents,
        );
      }
    }
    expect(top[0]!.revenueCents).toBe(Math.max(...byProduct.values()));
  });
});

describe("communityShare", () => {
  it("répartit les commandes entre communautés et particuliers", () => {
    expect(communityShare(scenarioOrders)).toEqual({
      community: 0,
      individual: scenarioOrders.length,
      percent: 0,
    });
    const mixed = scenarioOrders.map((o, i) =>
      i < 4 ? { ...o, community: { id: "com-0001", name: "Crèche" } } : o,
    );
    expect(communityShare(mixed)).toEqual({
      community: 4,
      individual: scenarioOrders.length - 4,
      percent: Math.round((4 / scenarioOrders.length) * 100),
    });
    expect(communityShare([])).toEqual({
      community: 0,
      individual: 0,
      percent: null,
    });
  });
});
