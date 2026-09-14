import { describe, expect, it } from "vitest";
import {
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
});

describe("affectations", () => {
  it("deux rôles, libellés français", () => {
    expect(ASSIGNMENT_ROLES).toEqual(["preparer", "driver"]);
    expect(ASSIGNMENT_ROLE_LABELS.preparer).toBe("Préparateur");
    expect(ASSIGNMENT_ROLE_LABELS.driver).toBe("Livreur");
  });
});
