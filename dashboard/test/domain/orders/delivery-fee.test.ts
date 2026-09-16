import { describe, expect, it } from "vitest";
import {
  DELIVERY_FEE_TIERS,
  deliveryFeeCents,
} from "@/domain/orders/delivery-fee";
import { computeOrderTotalCents } from "@/domain/orders/rules";
import {
  DELIVERY_SLOT_STARTS,
  isDeliverySlot,
  isOneHourSlot,
  slotEndFor,
} from "@/domain/orders/slot";

describe("deliveryFeeCents", () => {
  it("suit le barème du client sur le panier avant remise", () => {
    expect(deliveryFeeCents(0, false)).toBe(490);
    expect(deliveryFeeCents(499, false)).toBe(490);
    expect(deliveryFeeCents(500, false)).toBe(390);
    expect(deliveryFeeCents(999, false)).toBe(390);
    expect(deliveryFeeCents(1000, false)).toBe(290);
    expect(deliveryFeeCents(1999, false)).toBe(290);
    expect(deliveryFeeCents(2000, false)).toBe(190);
    expect(deliveryFeeCents(15_000, false)).toBe(190);
  });

  it("est offerte à toute communauté, quel que soit le panier", () => {
    expect(deliveryFeeCents(0, true)).toBe(0);
    expect(deliveryFeeCents(15_000, true)).toBe(0);
  });

  it("les paliers sont décroissants et commencent à zéro", () => {
    const mins = DELIVERY_FEE_TIERS.map((t) => t.minSubtotalCents);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins.at(-1)).toBe(0);
  });

  it("le total ajoute les frais après la remise, qui ne porte que sur les produits", () => {
    const lines = [
      {
        productId: "p",
        productName: "P",
        quantity: 1,
        unit: "piece" as const,
        lineTotalCents: 1000,
      },
    ];
    expect(computeOrderTotalCents(lines)).toBe(1000);
    expect(computeOrderTotalCents(lines, null, 290)).toBe(1290);
    expect(
      computeOrderTotalCents(
        lines,
        { kind: "loyalty", percent: 15, amountCents: 150 },
        290,
      ),
    ).toBe(1140);
    expect(
      computeOrderTotalCents(
        lines,
        { kind: "loyalty", percent: 15, amountCents: 5000 },
        290,
      ),
    ).toBe(290);
  });
});

describe("créneaux d'une heure", () => {
  it("la fin est l'heure de début plus un", () => {
    expect(slotEndFor("09:00")).toBe("10:00");
    expect(slotEndFor("14:00")).toBe("15:00");
    expect(slotEndFor("22:00")).toBe("23:00");
  });

  it("n'accepte qu'une heure pile, de 00:00 à 22:00", () => {
    expect(isOneHourSlot({ start: "14:00", end: "15:00" })).toBe(true);
    expect(isOneHourSlot({ start: "00:00", end: "01:00" })).toBe(true);
    expect(isOneHourSlot({ start: "14:00", end: "16:00" })).toBe(false);
    expect(isOneHourSlot({ start: "14:30", end: "15:30" })).toBe(false);
    expect(isOneHourSlot({ start: "23:00", end: "24:00" })).toBe(false);
    expect(isOneHourSlot({ start: "9:00", end: "10:00" })).toBe(false);
  });

  it("FIG livre entre 10:00 et 20:00 : dix créneaux, de 10:00 à 19:00", () => {
    expect(DELIVERY_SLOT_STARTS).toEqual([
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
    ]);
    expect(isDeliverySlot({ start: "10:00", end: "11:00" })).toBe(true);
    expect(isDeliverySlot({ start: "19:00", end: "20:00" })).toBe(true);
    expect(isDeliverySlot({ start: "09:00", end: "10:00" })).toBe(false);
    expect(isDeliverySlot({ start: "20:00", end: "21:00" })).toBe(false);
    expect(isDeliverySlot({ start: "14:00", end: "16:00" })).toBe(false);
  });
});
