import { describe, expect, it } from "vitest";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD,
  loyaltyStatus,
} from "@/domain/customers/loyalty";
import { scenarioOrders } from "@/domain/orders/fixtures";
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

  it("compte les commandes d'affilée et signale la remise au seuil", () => {
    const seven = Array.from({ length: 7 }, (_, i) => order(i + 1));
    expect(loyaltyStatus(seven)).toEqual({
      streak: 7,
      rewardReady: false,
      remaining: 1,
    });
    expect(loyaltyStatus([...seven, order(8)])).toEqual({
      streak: 8,
      rewardReady: true,
      remaining: 0,
    });
    expect(loyaltyStatus([])).toEqual({
      streak: 0,
      rewardReady: false,
      remaining: 8,
    });
  });

  it("une annulation remet la série à zéro, l'ordre chronologique compte", () => {
    const orders = [
      order(1),
      order(2),
      order(3, "cancelled"),
      order(4),
      order(5, "pending"),
    ];
    expect(loyaltyStatus(orders).streak).toBe(2);
    expect(loyaltyStatus(orders.toReversed()).streak).toBe(2);
  });

  it("la commande qui porte la remise fidélité consomme la série", () => {
    const eight = Array.from({ length: 8 }, (_, i) => order(i + 1));
    const rewarded = order(9, "delivered", {
      kind: "loyalty",
      percent: 15,
      amountCents: 100,
    });
    expect(loyaltyStatus([...eight, rewarded])).toEqual({
      streak: 0,
      rewardReady: false,
      remaining: 8,
    });
    expect(loyaltyStatus([...eight, rewarded, order(10)]).streak).toBe(1);
  });

  it("au-delà du seuil, la série reste plafonnée à 8 tant que la remise n'est pas passée", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => order(i + 1));
    expect(loyaltyStatus(twelve)).toEqual({
      streak: 8,
      rewardReady: true,
      remaining: 0,
    });
  });
});
