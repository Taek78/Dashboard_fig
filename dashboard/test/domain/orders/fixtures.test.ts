import { describe, expect, it } from "vitest";
import {
  FIXTURE_TODAY,
  orderEventsFixtures,
  ordersFixtures,
} from "@/domain/orders/fixtures";
import { computeOrderTotalCents } from "@/domain/orders/rules";
import { ORDER_STATUSES, statusPath } from "@/domain/orders/status";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = /^\d{2}:\d{2}$/;

describe("ordersFixtures", () => {
  it("contient 14 commandes", () => {
    expect(ordersFixtures).toHaveLength(14);
  });

  it("a des ids et des références uniques", () => {
    expect(new Set(ordersFixtures.map((o) => o.id)).size).toBe(
      ordersFixtures.length,
    );
    expect(new Set(ordersFixtures.map((o) => o.reference)).size).toBe(
      ordersFixtures.length,
    );
  });

  it.each(ORDER_STATUSES)(
    "contient au moins une commande au statut %s",
    (status) => {
      expect(ordersFixtures.some((o) => o.status === status)).toBe(true);
    },
  );

  it("couvre la veille, le jour et le lendemain de FIXTURE_TODAY", () => {
    const dates = new Set(ordersFixtures.map((o) => o.deliverySlot.date));
    expect(dates).toEqual(new Set(["2026-09-06", FIXTURE_TODAY, "2026-09-08"]));
  });

  it.each(ordersFixtures)(
    "$id : totalCents cohérent avec les lignes",
    (order) => {
      expect(computeOrderTotalCents(order.lines)).toBe(order.totalCents);
    },
  );

  it.each(ordersFixtures)("$id : entre 2 et 5 lignes", (order) => {
    expect(order.lines.length).toBeGreaterThanOrEqual(2);
    expect(order.lines.length).toBeLessThanOrEqual(5);
  });

  it.each(ordersFixtures)("$id : dates et heures au format ISO", (order) => {
    expect(order.createdAt).toMatch(ISO_DATETIME);
    expect(order.deliverySlot.date).toMatch(ISO_DATE);
    expect(order.deliverySlot.start).toMatch(HOUR);
    expect(order.deliverySlot.end).toMatch(HOUR);
    expect(order.deliverySlot.start < order.deliverySlot.end).toBe(true);
  });

  it.each(ordersFixtures)("$id : aucune donnée personnelle réelle", (order) => {
    expect(order.customer.email).toMatch(/@example\.invalid$/);
    expect(order.customer.phone).toMatch(/^06 39 98 00 \d{2}$/);
    expect(order.deliveryPostalCode).toMatch(/^\d{5}$/);
    expect(order).not.toHaveProperty("street");
  });

  it("garde un client cohérent d'une commande à l'autre", () => {
    const byId = new Map<string, string>();
    for (const { customer } of ordersFixtures) {
      const seen = byId.get(customer.id);
      if (seen !== undefined) expect(seen).toBe(customer.email);
      byId.set(customer.id, customer.email);
    }
  });
});

describe("orderEventsFixtures", () => {
  it("retrace pour chaque commande le chemin jusqu'à son statut actuel", () => {
    for (const order of ordersFixtures) {
      const mine = orderEventsFixtures.filter((e) => e.orderId === order.id);
      const path = statusPath(order.status);
      expect(mine.map((e) => e.to)).toEqual(path.slice(1));
      expect(mine.map((e) => e.from)).toEqual(path.slice(0, -1));
      for (const e of mine) {
        expect(e.at > order.createdAt).toBe(true);
        expect(e.at).toMatch(ISO_DATETIME);
      }
    }
    expect(new Set(orderEventsFixtures.map((e) => e.id)).size).toBe(
      orderEventsFixtures.length,
    );
  });
});

describe("ordersFixtures : annulations", () => {
  it("les commandes annulées portent un motif, les autres non", () => {
    for (const order of ordersFixtures) {
      if (order.status === "cancelled") {
        expect(order.cancellation).not.toBeNull();
        expect(
          order.cancellation?.reason === "other"
            ? (order.cancellation.detail?.length ?? 0) > 0
            : order.cancellation?.detail === null,
        ).toBe(true);
      } else {
        expect(order.cancellation).toBeNull();
      }
    }
    const cancelledEvents = orderEventsFixtures.filter(
      (e) => e.to === "cancelled",
    );
    expect(cancelledEvents.length).toBeGreaterThan(0);
    for (const e of cancelledEvents) expect(e.cancellation).not.toBeNull();
  });
});
