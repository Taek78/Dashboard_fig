import { describe, expect, it } from "vitest";
import {
  CUSTOMER_TIER_LABELS,
  CUSTOMER_TIER_STARS,
  CUSTOMER_TIERS,
  customerTier,
  LOYAL_TIER_MONTHS,
  loyalTierEvents,
  tierExpiry,
  tierFromReachedAt,
} from "@/domain/customers/tier";
import { scenarioOrders } from "@/domain/orders/fixtures";
import type { Order } from "@/domain/orders/types";

const base = scenarioOrders[0]!;
const order = (
  n: number,
  status: Order["status"] = "delivered",
  discount: Order["discount"] = null,
): Order => ({
  ...base,
  id: `t-${String(n).padStart(2, "0")}`,
  reference: `T-${n}`,
  createdAt: `2026-01-${String(n).padStart(2, "0")}T10:00:00.000Z`,
  status,
  cancellation: null,
  discount,
});
const loyalty = { kind: "loyalty" as const, percent: 15, amountCents: 100 };

describe("catégories", () => {
  it("deux catégories, libellées, avec plus d'étoiles pour la fidèle", () => {
    expect(CUSTOMER_TIERS).toEqual(["basic", "loyal"]);
    expect(CUSTOMER_TIER_LABELS).toEqual({ basic: "Basique", loyal: "Fidèle" });
    expect(CUSTOMER_TIER_STARS.loyal).toBeGreaterThan(
      CUSTOMER_TIER_STARS.basic,
    );
    expect(LOYAL_TIER_MONTHS).toBe(2);
  });
});

describe("loyalTierEvents", () => {
  it("date chaque atteinte par la huitième commande comptée du cycle", () => {
    const eight = Array.from({ length: 8 }, (_, i) => order(i + 1));
    expect(loyalTierEvents(eight.toReversed())).toEqual([
      {
        reachedAt: "2026-01-08T10:00:00.000Z",
        expiresAt: "2026-03-08T10:00:00.000Z",
        orderId: "t-08",
        orderReference: "T-8",
      },
    ]);
    expect(loyalTierEvents(eight.slice(0, 7))).toEqual([]);
  });

  it("ignore les annulées, ne compte pas la commande remisée, et recommence au cycle suivant", () => {
    const orders = [
      ...Array.from({ length: 4 }, (_, i) => order(i + 1)),
      order(5, "cancelled"),
      ...Array.from({ length: 4 }, (_, i) => order(i + 6)),
      order(10, "delivered", loyalty),
      ...Array.from({ length: 8 }, (_, i) => order(i + 11)),
      order(19),
    ];
    const events = loyalTierEvents(orders);
    expect(events.map((e) => e.orderId)).toEqual(["t-09", "t-18"]);
  });

  it("un compteur qui dépasse huit sans remise ne crée pas de nouvelle atteinte", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => order(i + 1));
    expect(loyalTierEvents(twelve).map((e) => e.orderId)).toEqual(["t-08"]);
  });
});

describe("tierExpiry / tierFromReachedAt / customerTier", () => {
  it("fidèle pendant deux mois civils, début inclus, fin exclue", () => {
    const reached = "2026-01-08T10:00:00.000Z";
    expect(tierExpiry(reached)).toBe("2026-03-08T10:00:00.000Z");
    expect(tierFromReachedAt(reached, "2026-01-08T10:00:00.000Z")).toEqual({
      tier: "loyal",
      since: reached,
      until: "2026-03-08T10:00:00.000Z",
    });
    expect(tierFromReachedAt(reached, "2026-03-08T09:59:59.000Z").tier).toBe(
      "loyal",
    );
    expect(tierFromReachedAt(reached, "2026-03-08T10:00:00.000Z")).toEqual({
      tier: "basic",
      since: null,
      until: null,
    });
    expect(tierFromReachedAt(reached, "2026-01-07T00:00:00.000Z").tier).toBe(
      "basic",
    );
    expect(tierFromReachedAt(null, "2026-01-07T00:00:00.000Z").tier).toBe(
      "basic",
    );
  });

  it("la fin de mois est ramenée au dernier jour, comme PostgreSQL", () => {
    expect(tierExpiry("2026-12-31T08:00:00.000Z")).toBe(
      "2027-02-28T08:00:00.000Z",
    );
    expect(tierExpiry("2028-12-31T08:00:00.000Z")).toBe(
      "2029-02-28T08:00:00.000Z",
    );
    expect(tierExpiry("2026-07-31T08:00:00.000Z")).toBe(
      "2026-09-30T08:00:00.000Z",
    );
  });

  it("customerTier prend la dernière atteinte", () => {
    const orders = [
      ...Array.from({ length: 8 }, (_, i) => order(i + 1)),
      order(9, "delivered", loyalty),
      ...Array.from({ length: 8 }, (_, i) => order(i + 10)),
    ];
    expect(customerTier(orders, "2026-01-20T00:00:00.000Z")).toEqual({
      tier: "loyal",
      since: "2026-01-17T10:00:00.000Z",
      until: "2026-03-17T10:00:00.000Z",
    });
    expect(customerTier(orders, "2026-04-01T00:00:00.000Z").tier).toBe("basic");
    expect(customerTier([], "2026-04-01T00:00:00.000Z").tier).toBe("basic");
  });
});
