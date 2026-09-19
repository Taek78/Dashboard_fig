import { describe, expect, it } from "vitest";
import {
  communityShare,
  communityShareFrom,
  computeKpis,
  countByStatus,
  fillSeries,
  orderStats,
  orderTotals,
  ordersByStatus,
  rankProducts,
  revenueSeries,
  statsFromTotals,
  statusPoints,
  topProducts,
} from "@/domain/metrics/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";

/*
 * Règles pures qui mettent en forme les totaux AGRÉGÉS (par la base ou en
 * mémoire) : les deux chemins doivent donner les mêmes chiffres.
 * test/data/orders.db.test.ts compare ensuite la base à ces règles.
 */
describe("orderTotals / statsFromTotals", () => {
  it("donnent les mêmes KPI, répartition et part des communautés que le calcul direct", () => {
    const stats = statsFromTotals(orderTotals(scenarioOrders));
    expect(stats).toEqual(orderStats(scenarioOrders));
    expect(stats.kpis).toEqual(computeKpis(scenarioOrders));
    expect(stats.share).toEqual(communityShare(scenarioOrders));
    expect(statusPoints(stats.statusCounts)).toEqual(
      ordersByStatus(scenarioOrders),
    );
  });

  it("sans commande : zéros partout, panier moyen 0, part des communautés inconnue", () => {
    expect(orderStats([])).toEqual({
      kpis: {
        orderCount: 0,
        revenueCents: 0,
        averageBasketCents: 0,
        cancelledCount: 0,
        preparingCount: 0,
      },
      statusCounts: countByStatus([]),
      share: { community: 0, individual: 0, percent: null },
      buyers: 0,
      refunds: {
        refund: { count: 0, amountCents: 0, percent: null },
        credit: { count: 0, amountCents: 0, percent: null },
      },
    });
    expect(communityShareFrom(1, 3)).toEqual({
      community: 1,
      individual: 2,
      percent: 33,
    });
  });
});

describe("fillSeries", () => {
  it("complète les seaux vides et calcule le panier moyen une seule fois", () => {
    const range = { from: "2026-09-05", to: "2026-09-08" };
    expect(
      fillSeries(range, "day", [
        {
          key: "2026-09-07",
          orderCount: 3,
          cancelledCount: 1,
          revenueCents: 1001,
          buyers: 2,
        },
      ]),
    ).toEqual([
      expect.objectContaining({ key: "2026-09-05", orderCount: 0 }),
      expect.objectContaining({ key: "2026-09-06", orderCount: 0 }),
      {
        key: "2026-09-07",
        orderCount: 3,
        cancelledCount: 1,
        revenueCents: 1001,
        averageBasketCents: 501,
        buyers: 2,
      },
      expect.objectContaining({ key: "2026-09-08", averageBasketCents: 0 }),
    ]);
  });

  it("par semaine, la clé est le lundi, même quand la plage commence un autre jour", () => {
    const series = revenueSeries(
      scenarioOrders,
      { from: "2026-09-03", to: "2026-09-16" },
      "week",
    );
    expect(series.map((p) => p.key)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });
});

describe("rankProducts", () => {
  it("classe par CA décroissant puis par nom, et coupe à la limite", () => {
    const p = (productName: string, revenueCents: number) => ({
      productId: productName,
      productName,
      revenueCents,
      quantity: 1,
      unit: "piece" as const,
    });
    expect(
      rankProducts([p("Poires", 10), p("Abricots", 30), p("Cerises", 30)], 2),
    ).toEqual([p("Abricots", 30), p("Cerises", 30)]);
    expect(topProducts(scenarioOrders, 3)).toEqual(
      rankProducts(topProducts(scenarioOrders, 100), 3),
    );
  });
});
