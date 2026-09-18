import { describe, expect, it } from "vitest";
import {
  buildQuote,
  hourInParis,
  isSlotBookable,
  lineTotalCents,
  orderReference,
  type QuoteContext,
} from "@/domain/orders/quote";
import { slotEndFor } from "@/domain/orders/slot";
import { productsFixtures } from "@/domain/products/fixtures";
import { addDays } from "@/lib/days";

const base: QuoteContext = {
  products: productsFixtures,
  settings: { sellWhenOutOfStock: false },
  loyaltyReady: false,
  community: null,
  communityPercent: 0,
};
const carrots = productsFixtures.find((p) => p.id === "prd-0001")!; // 2,90 € le kg
const salad = productsFixtures.find((p) => p.id === "prd-0006")!; // 1,80 € la pièce

describe("lineTotalCents", () => {
  it("multiplie le prix au kilo par les grammes, ou le prix à la pièce par les pièces", () => {
    expect(lineTotalCents(carrots, 1000)).toBe(290);
    expect(lineTotalCents(carrots, 250)).toBe(73);
    expect(lineTotalCents(salad, 3)).toBe(540);
  });
});

describe("buildQuote", () => {
  it("calcule lignes, sous-total, frais au barème et total, sans remise", () => {
    const result = buildQuote(
      [
        { productId: carrots.id, quantity: 1000 },
        { productId: salad.id, quantity: 2 },
      ],
      base,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.lines).toEqual([
      {
        productId: carrots.id,
        productName: carrots.name,
        unit: "g",
        quantity: 1000,
        unitPriceCents: carrots.priceCents,
        lineTotalCents: 290,
      },
      {
        productId: salad.id,
        productName: salad.name,
        unit: "piece",
        quantity: 2,
        unitPriceCents: salad.priceCents,
        lineTotalCents: 360,
      },
    ]);
    expect(result.quote.subtotalCents).toBe(650);
    expect(result.quote.discount).toBeNull();
    expect(result.quote.deliveryFeeCents).toBe(390);
    expect(result.quote.totalCents).toBe(1040);
    expect(result.quote.community).toBeNull();
  });

  it("applique la meilleure remise et la livraison offerte d'une communauté", () => {
    const cart = [{ productId: carrots.id, quantity: 10_000 }];
    const community = { id: "com-0001", name: "Crèche Les Lucioles" };
    const withCommunity = buildQuote(cart, {
      ...base,
      community,
      communityPercent: 10,
    });
    expect(withCommunity.ok && withCommunity.quote).toMatchObject({
      discount: { kind: "community", percent: 10, amountCents: 290 },
      deliveryFeeCents: 0,
      totalCents: 2610,
      community,
    });
    const loyal = buildQuote(cart, {
      ...base,
      community,
      communityPercent: 10,
      loyaltyReady: true,
    });
    expect(loyal.ok && loyal.quote).toMatchObject({
      discount: { kind: "loyalty", percent: 15, amountCents: 435 },
      deliveryFeeCents: 0,
      totalCents: 2465,
    });
    const loyalAlone = buildQuote(cart, { ...base, loyaltyReady: true });
    expect(loyalAlone.ok && loyalAlone.quote).toMatchObject({
      discount: { kind: "loyalty", percent: 15, amountCents: 435 },
      deliveryFeeCents: 190,
      totalCents: 2655,
    });
  });

  it("liste TOUS les problèmes : produit inconnu, masqué, hors vente, stock, quantité, doublon", () => {
    const hidden = productsFixtures.find((p) => !p.visible);
    const unavailable = productsFixtures.find((p) => p.visible && !p.available);
    const result = buildQuote(
      [
        { productId: "prd-9999", quantity: 1 },
        ...(hidden ? [{ productId: hidden.id, quantity: 1 }] : []),
        ...(unavailable ? [{ productId: unavailable.id, quantity: 1 }] : []),
        { productId: carrots.id, quantity: carrots.stockQuantity + 1 },
        { productId: salad.id, quantity: 501 },
        { productId: salad.id, quantity: 1 },
      ],
      base,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = Object.fromEntries(
      result.problems.map((p) => [p.productId + ":" + p.code, p.message]),
    );
    expect(codes["prd-9999:unknown_product"]).toBeDefined();
    if (hidden) expect(codes[`${hidden.id}:unknown_product`]).toBeDefined();
    if (unavailable)
      expect(codes[`${unavailable.id}:not_for_sale`]).toBeDefined();
    expect(codes[`${carrots.id}:stock_insufficient`]).toBeDefined();
    expect(codes[`${salad.id}:quantity_too_large`]).toBeDefined();
    expect(codes[`${salad.id}:duplicate_line`]).toBeDefined();
    expect(result.problems.every((p) => p.message.length > 0)).toBe(true);
  });

  it("laisse commander au-delà du stock quand le catalogue vend à stock 0", () => {
    const result = buildQuote(
      [{ productId: carrots.id, quantity: carrots.stockQuantity + 1000 }],
      {
        ...base,
        settings: { sellWhenOutOfStock: true },
      },
    );
    expect(result.ok).toBe(true);
  });
});

describe("isSlotBookable", () => {
  // 2026-09-17 à 12:00 UTC = 14:00 à Paris (heure d'été).
  const now = new Date("2026-09-17T12:00:00.000Z");
  const slot = (date: string, start: string) => ({
    date,
    start,
    end: slotEndFor(start),
  });

  it("accepte un créneau FIG d'aujourd'hui (deux heures de délai) à trente jours, en heure de Paris", () => {
    expect(hourInParis(now)).toBe(14);
    expect(isSlotBookable(slot("2026-09-17", "16:00"), now)).toBe(true);
    expect(isSlotBookable(slot("2026-09-17", "15:00"), now)).toBe(false);
    expect(isSlotBookable(slot("2026-09-18", "10:00"), now)).toBe(true);
    expect(isSlotBookable(slot("2026-10-17", "19:00"), now)).toBe(true);
    expect(isSlotBookable(slot("2026-10-18", "10:00"), now)).toBe(false);
    expect(isSlotBookable(slot("2026-09-16", "19:00"), now)).toBe(false);
    expect(isSlotBookable(slot("2026-09-18", "09:00"), now)).toBe(false);
    expect(isSlotBookable(slot("2026-09-18", "20:00"), now)).toBe(false);
    expect(
      isSlotBookable({ date: "2026-09-18", start: "10:00", end: "12:00" }, now),
    ).toBe(false);
    expect(isSlotBookable(slot(addDays("2026-09-17", 30), "10:00"), now)).toBe(
      true,
    );
  });
});

describe("orderReference", () => {
  it("écrit FIG-AAMMJJ-NNN sur le jour de livraison", () => {
    expect(orderReference("2026-09-20", 1)).toBe("FIG-260920-001");
    expect(orderReference("2026-09-20", 1000)).toBe("FIG-260920-1000");
  });
});
