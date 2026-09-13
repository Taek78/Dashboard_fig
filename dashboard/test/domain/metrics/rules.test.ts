import { describe, expect, it } from "vitest";
import {
  computeKpis,
  daysBefore,
  filterByPeriod,
  ordersByStatus,
  revenueByDay,
  topProducts,
} from "@/domain/metrics/rules";
import { ordersFixtures } from "@/domain/orders/fixtures";

/*
 * Les attendus sont recalculés ici de façon indépendante (boucles simples) sur les
 * fixtures : la page affiche exactement ces valeurs.
 */
const active = ordersFixtures.filter((o) => o.status !== "cancelled");
const expectedRevenue = active.reduce((s, o) => s + o.totalCents, 0);

describe("daysBefore", () => {
  it("recule de n jours, changement de mois compris", () => {
    expect(daysBefore("2026-09-13", 6)).toBe("2026-09-07");
    expect(daysBefore("2026-09-01", 1)).toBe("2026-08-31");
    expect(daysBefore("2026-09-13", 0)).toBe("2026-09-13");
  });
});

describe("filterByPeriod", () => {
  it("7 jours au 2026-09-13 : du 07 au 13 inclus", () => {
    const r = filterByPeriod(ordersFixtures, "7", "2026-09-13");
    expect(r.every((o) => o.deliverySlot.date >= "2026-09-07")).toBe(true);
    expect(r).toHaveLength(10);
  });

  it("30 jours et tout couvrent les 14 fixtures", () => {
    expect(filterByPeriod(ordersFixtures, "30", "2026-09-13")).toHaveLength(14);
    expect(filterByPeriod(ordersFixtures, "tout", "2026-09-13")).toHaveLength(
      14,
    );
  });

  it("exclut les jours futurs", () => {
    expect(filterByPeriod(ordersFixtures, "7", "2026-09-06")).toHaveLength(4);
  });
});

describe("computeKpis", () => {
  it("calcule CA hors annulées, panier moyen, annulées, en attente", () => {
    const k = computeKpis(ordersFixtures);
    expect(k.orderCount).toBe(14);
    expect(k.cancelledCount).toBe(2);
    expect(k.pendingCount).toBe(3);
    expect(k.revenueCents).toBe(expectedRevenue);
    expect(k.averageBasketCents).toBe(Math.round(expectedRevenue / 12));
    expect(Number.isInteger(k.averageBasketCents)).toBe(true);
  });

  it("sans commande : zéros, pas de division par zéro", () => {
    expect(computeKpis([])).toEqual({
      orderCount: 0,
      revenueCents: 0,
      averageBasketCents: 0,
      cancelledCount: 0,
      pendingCount: 0,
    });
  });
});

describe("revenueByDay", () => {
  it("un point par jour trié, CA hors annulées, volume toutes commandes", () => {
    const days = revenueByDay(ordersFixtures);
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ]);
    const d8 = days[2]!;
    const orders8 = ordersFixtures.filter(
      (o) => o.deliverySlot.date === "2026-09-08",
    );
    expect(d8.orderCount).toBe(5);
    expect(d8.revenueCents).toBe(
      orders8
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.totalCents, 0),
    );
    expect(days.reduce((s, d) => s + d.revenueCents, 0)).toBe(expectedRevenue);
  });
});

describe("ordersByStatus", () => {
  it("une entrée par statut dans l'ordre du cycle, y compris à zéro", () => {
    const s = ordersByStatus(ordersFixtures);
    expect(s.map((p) => [p.status, p.count])).toEqual([
      ["pending", 3],
      ["confirmed", 3],
      ["preparing", 1],
      ["delivering", 2],
      ["delivered", 3],
      ["cancelled", 2],
    ]);
    expect(ordersByStatus([]).every((p) => p.count === 0)).toBe(true);
  });
});

describe("topProducts", () => {
  it("classe par CA décroissant hors annulées et respecte la limite", () => {
    const top = topProducts(ordersFixtures, 3);
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
    const bestRevenue = Math.max(...byProduct.values());
    const bestIds = [...byProduct.entries()]
      .filter(([, v]) => v === bestRevenue)
      .map(([id]) => id);
    // À CA égal, ordre alphabétique du nom : le premier est l'un des meilleurs.
    expect(bestIds).toContain(top[0]!.productId);
    expect(top[0]!.revenueCents).toBe(bestRevenue);
  });

  it("cumule les quantités d'un même produit", () => {
    const all = topProducts(ordersFixtures, 100);
    const carottes = all.find((p) => p.productId === "prd-0001")!;
    const expected = active
      .flatMap((o) => o.lines)
      .filter((l) => l.productId === "prd-0001")
      .reduce((s, l) => s + l.quantity, 0);
    expect(carottes.quantity).toBe(expected);
    expect(carottes.unit).toBe("g");
  });
});
