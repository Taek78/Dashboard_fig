import { describe, expect, it } from "vitest";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD,
  loyaltyCount,
  loyaltyFromCount,
  loyaltyStatus,
} from "@/domain/customers/loyalty";
import { ordersFixtures, scenarioOrders } from "@/domain/orders/fixtures";
import type { Order } from "@/domain/orders/types";

const base = scenarioOrders[0]!;
const order = (
  n: number,
  status: Order["status"] = "delivered",
  discount: Order["discount"] = null,
): Order => ({
  ...base,
  id: `t-${n}`,
  createdAt: `2026-01-${String(n).padStart(2, "0")}T10:00:00.000Z`,
  status,
  cancellation: null,
  discount,
});

describe("loyaltyStatus", () => {
  it("seuil et remise attendus par le client", () => {
    expect(LOYALTY_THRESHOLD).toBe(8);
    expect(LOYALTY_DISCOUNT_PERCENT).toBe(15);
  });

  it("compte les commandes cumulées et signale la remise au seuil", () => {
    const seven = Array.from({ length: 7 }, (_, i) => order(i + 1));
    expect(loyaltyStatus(seven)).toEqual({
      count: 7,
      rewardReady: false,
      remaining: 1,
    });
    expect(loyaltyStatus([...seven, order(8)])).toEqual({
      count: 8,
      rewardReady: true,
      remaining: 0,
    });
    expect(loyaltyStatus([])).toEqual({
      count: 0,
      rewardReady: false,
      remaining: 8,
    });
  });

  it("une annulation ne compte pas et NE remet PAS le compteur à zéro ; l'ordre chronologique compte", () => {
    const orders = [
      order(1),
      order(2),
      order(3, "cancelled"),
      order(4),
      order(5, "preparing"),
    ];
    expect(loyaltyStatus(orders).count).toBe(4);
    expect(loyaltyStatus(orders.toReversed()).count).toBe(4);
  });

  it("la commande qui porte la remise fidélité consomme le compteur, qui repart de zéro", () => {
    const eight = Array.from({ length: 8 }, (_, i) => order(i + 1));
    const rewarded = order(9, "delivered", {
      kind: "loyalty",
      percent: 15,
      amountCents: 100,
    });
    expect(loyaltyStatus([...eight, rewarded])).toEqual({
      count: 0,
      rewardReady: false,
      remaining: 8,
    });
    expect(loyaltyStatus([...eight, rewarded, order(10)]).count).toBe(1);
  });

  it("au-delà du seuil, le compteur reste plafonné à 8 tant que la remise n'est pas passée", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => order(i + 1));
    expect(loyaltyStatus(twelve)).toEqual({
      count: 8,
      rewardReady: true,
      remaining: 0,
    });
    expect(loyaltyCount(twelve)).toBe(12);
  });
});

/* Compteur brut (ce que la base compte) et état de fidélité qui en découle. */
describe("loyaltyCount / loyaltyFromCount", () => {
  it("l'état tiré du compteur brut est celui de loyaltyStatus, pour chaque client des fixtures", () => {
    const ids = new Set(ordersFixtures.map((o) => o.customer.id));
    for (const id of ids) {
      const mine = ordersFixtures.filter((o) => o.customer.id === id);
      expect(loyaltyFromCount(loyaltyCount(mine))).toEqual(loyaltyStatus(mine));
    }
  });

  it("plafonne le compteur au seuil et annonce la remise", () => {
    expect(loyaltyFromCount(0)).toEqual({
      count: 0,
      rewardReady: false,
      remaining: LOYALTY_THRESHOLD,
    });
    expect(loyaltyFromCount(LOYALTY_THRESHOLD + 3)).toEqual({
      count: LOYALTY_THRESHOLD,
      rewardReady: true,
      remaining: 0,
    });
  });
});
