import { describe, expect, it } from "vitest";
import { visibleUnread } from "@/lib/alert-events";

describe("visibleUnread (compteurs du menu)", () => {
  const update = {
    counts: { orders: 3, messages: 2, stock: 1 },
    polledAt: 1000,
  };

  it("affiche les compteurs du relevé", () => {
    expect(visibleUnread(update, {})).toEqual({
      orders: 3,
      messages: 2,
      stock: 1,
    });
  });

  it("un relevé parti AVANT la visite d'une section ne rallume pas son compteur", () => {
    expect(visibleUnread(update, { orders: 1500 })).toEqual({
      orders: 0,
      messages: 2,
      stock: 1,
    });
    // Relevé parti après la visite : il fait foi.
    expect(
      visibleUnread({ ...update, polledAt: 2000 }, { orders: 1500 }),
    ).toEqual({ orders: 3, messages: 2, stock: 1 });
  });
});
