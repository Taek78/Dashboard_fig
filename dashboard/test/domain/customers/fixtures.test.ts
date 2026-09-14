import { describe, expect, it } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";

describe("customersFixtures", () => {
  it("correspondent exactement aux clients des commandes (id, nom, e-mail, téléphone)", () => {
    const fromOrders = new Map(
      ordersFixtures.map((o) => [
        o.customer.id,
        {
          fullName: o.customer.fullName,
          email: o.customer.email,
          phone: o.customer.phone,
        },
      ]),
    );
    expect(new Set(customersFixtures.map((c) => c.id))).toEqual(
      new Set(fromOrders.keys()),
    );
    for (const c of customersFixtures) {
      expect(fromOrders.get(c.id)).toEqual({
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
      });
    }
  });

  it("n'exposent aucune personne réelle", () => {
    for (const c of customersFixtures) {
      expect(c.email.endsWith("@example.invalid")).toBe(true);
      expect(c.phone).toMatch(/^06 39 98 \d{2} \d{2}$/);
    }
  });

  it("ont des notes avec des ids uniques et des dates ISO", () => {
    const ids = customersFixtures.flatMap((c) => c.notes.map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of customersFixtures) {
      for (const n of c.notes) {
        expect(new Date(n.createdAt).toISOString()).toBe(n.createdAt);
      }
    }
  });
});
