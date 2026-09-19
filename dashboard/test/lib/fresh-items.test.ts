import { describe, expect, it } from "vitest";
import {
  afterReload,
  EMPTY_FRESH,
  FRESH_MS,
  isFresh,
  withEntered,
  withFresh,
  withoutFresh,
} from "@/lib/fresh-items";

describe("badge « Nouveau » (fresh-items)", () => {
  const t0 = 1_000_000;

  it("une minute après l'arrivée, puis éteint", () => {
    const state = withFresh(EMPTY_FRESH, "orders", ["a"], t0);
    expect(isFresh(state.orders.a, t0 + FRESH_MS - 1)).toBe(true);
    expect(isFresh(state.orders.a, t0 + FRESH_MS)).toBe(false);
    expect(isFresh(undefined, t0)).toBe(false);
  });

  it("ouvrir le détail éteint la nouveauté, les autres restent", () => {
    const state = withFresh(EMPTY_FRESH, "messages", ["m1", "m2"], t0);
    const after = withoutFresh(state, "messages", "m1");
    expect(Object.keys(after.messages)).toEqual(["m2"]);
    expect(withoutFresh(after, "messages", "inconnu")).toBe(after);
  });

  it("rechargement : éteinte seulement si sa section a été ouverte depuis", () => {
    let state = withFresh(EMPTY_FRESH, "orders", ["a"], t0);
    state = withFresh(state, "messages", ["m"], t0);
    state = withEntered(state, "orders");
    const reloaded = afterReload(state, t0 + 1000);
    expect(reloaded.orders).toEqual({});
    expect(Object.keys(reloaded.messages)).toEqual(["m"]);
    // Et jamais au-delà de sa minute.
    expect(afterReload(state, t0 + FRESH_MS).messages).toEqual({});
  });

  it("une nouveauté arrivée après l'entrée dans la section n'est pas encore « entrée »", () => {
    let state = withFresh(EMPTY_FRESH, "orders", ["a"], t0);
    state = withEntered(state, "orders");
    state = withFresh(state, "orders", ["b"], t0 + 10);
    expect(state.orders.a?.entered).toBe(true);
    expect(state.orders.b?.entered).toBe(false);
    expect(
      withEntered(withEntered(state, "orders"), "orders").orders.b?.entered,
    ).toBe(true);
  });
});
