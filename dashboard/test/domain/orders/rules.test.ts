import { describe, expect, it } from "vitest";
import { computeOrderTotalCents } from "@/domain/orders/rules";
import type { OrderLine } from "@/domain/orders/types";

const line = (lineTotalCents: number): OrderLine => ({
  productId: "prd-0001",
  productName: "Carottes",
  quantity: 500,
  unit: "g",
  lineTotalCents,
});

describe("computeOrderTotalCents", () => {
  it("renvoie 0 pour une commande sans ligne", () => {
    expect(computeOrderTotalCents([])).toBe(0);
  });

  it("additionne les totaux de ligne", () => {
    expect(computeOrderTotalCents([line(1250), line(390)])).toBe(1640);
  });

  it("reste en centimes entiers", () => {
    expect(
      Number.isInteger(
        computeOrderTotalCents([line(110), line(110), line(110)]),
      ),
    ).toBe(true);
  });
});
