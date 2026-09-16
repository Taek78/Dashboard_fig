import { describe, expect, it } from "vitest";
import {
  bestDiscount,
  DISCOUNT_KINDS,
  discountAmountCents,
  formatDiscount,
} from "@/domain/orders/discount";
import {
  ASSIGNMENT_ROLE_LABELS,
  ASSIGNMENT_ROLES,
} from "@/domain/orders/assignment";

describe("remises", () => {
  it("deux natures de remise, libellées", () => {
    expect(DISCOUNT_KINDS).toEqual(["community", "loyalty"]);
    expect(
      formatDiscount({ kind: "community", percent: 10, amountCents: 100 }),
    ).toBe("−10 % communauté");
    expect(
      formatDiscount({ kind: "loyalty", percent: 15, amountCents: 100 }),
    ).toBe("−15 % fidélité");
  });

  it("le montant est arrondi au centime", () => {
    expect(discountAmountCents(1000, 10)).toBe(100);
    expect(discountAmountCents(995, 15)).toBe(149);
    expect(discountAmountCents(0, 15)).toBe(0);
  });

  it("la meilleure remise l'emporte, jamais les deux", () => {
    expect(bestDiscount(false, null)).toBeNull();
    expect(bestDiscount(false, 0)).toBeNull();
    expect(bestDiscount(false, 5)).toEqual({ kind: "community", percent: 5 });
    expect(bestDiscount(true, null)).toEqual({ kind: "loyalty", percent: 15 });
    expect(bestDiscount(true, 10)).toEqual({ kind: "loyalty", percent: 15 });
    // Une communauté plus généreuse que la fidélité la garderait.
    expect(bestDiscount(true, 20)).toEqual({ kind: "community", percent: 20 });
    // À égalité, la fidélité passe : elle se consomme, l'autre revient ensuite.
    expect(bestDiscount(true, 15)).toEqual({ kind: "loyalty", percent: 15 });
  });
});

describe("affectations", () => {
  it("deux rôles, libellés français", () => {
    expect(ASSIGNMENT_ROLES).toEqual(["preparer", "driver"]);
    expect(ASSIGNMENT_ROLE_LABELS.preparer).toBe("Préparateur");
    expect(ASSIGNMENT_ROLE_LABELS.driver).toBe("Livreur");
  });
});
