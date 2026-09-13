import { describe, expect, it } from "vitest";
import {
  assignmentsFixtures,
  couriersFixtures,
} from "@/domain/deliveries/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";

describe("couriersFixtures", () => {
  it("ont des ids uniques et des téléphones dans la tranche fictive", () => {
    const ids = couriersFixtures.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of couriersFixtures) {
      expect(c.phone).toMatch(/^06 39 98 00 \d{2}$/);
    }
  });
});

describe("assignmentsFixtures", () => {
  it("référencent des commandes et des livreurs existants", () => {
    const orderIds = new Set(ordersFixtures.map((o) => o.id));
    const courierIds = new Set(couriersFixtures.map((c) => c.id));
    for (const a of assignmentsFixtures) {
      expect(orderIds.has(a.orderId)).toBe(true);
      expect(courierIds.has(a.courierId)).toBe(true);
    }
  });

  it("copient exactement le créneau de la commande", () => {
    const byId = new Map(ordersFixtures.map((o) => [o.id, o]));
    for (const a of assignmentsFixtures) {
      const slot = byId.get(a.orderId)!.deliverySlot;
      expect({ date: a.date, start: a.start, end: a.end }).toEqual(slot);
    }
  });

  it("n'ont qu'une attribution par commande et aucun conflit interne", () => {
    const orders = assignmentsFixtures.map((a) => a.orderId);
    expect(new Set(orders).size).toBe(orders.length);
    const slots = assignmentsFixtures.map(
      (a) => `${a.courierId}|${a.date}|${a.start}`,
    );
    expect(new Set(slots).size).toBe(slots.length);
  });
});
