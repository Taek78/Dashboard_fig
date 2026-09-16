import { describe, expect, it } from "vitest";
import {
  customersFixtures,
  scenarioCustomers,
} from "@/domain/customers/fixtures";
import { isReferralCode } from "@/domain/customers/referral";
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
      expect(c.addressLine).toMatch(/^\d+ /);
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

  it("ont chacun un code de parrainage unique au bon format, et des parrains existants", () => {
    const codes = customersFixtures.map((c) => c.referralCode);
    expect(codes.every((code) => code !== null && isReferralCode(code))).toBe(
      true,
    );
    expect(new Set(codes).size).toBe(codes.length);
    const byId = new Map(customersFixtures.map((c) => [c.id, c]));
    const referred = customersFixtures.filter((c) => c.referredBy !== null);
    expect(referred.length).toBeGreaterThan(5);
    for (const c of referred) {
      const referrer = byId.get(c.referredBy!.id);
      expect(referrer?.fullName).toBe(c.referredBy!.fullName);
      expect(c.referredBy!.id).not.toBe(c.id);
    }
    expect(
      customersFixtures.filter((c) => c.referredBy?.id === "cli-0001"),
    ).toHaveLength(2);
  });

  it("ont des autorisations datées de la création du compte, dans les deux sens", () => {
    for (const c of customersFixtures) {
      expect(c.consents.updatedAt).toBe(c.createdAt);
    }
    const granted = (key: "offers" | "orderStatus" | "marketing") =>
      scenarioCustomers.filter((c) => c.consents[key]).length;
    for (const key of ["offers", "orderStatus", "marketing"] as const) {
      expect(granted(key)).toBeGreaterThan(0);
      expect(granted(key)).toBeLessThan(scenarioCustomers.length);
    }
  });
});
