import { describe, expect, it } from "vitest";
import { scenarioOrders } from "@/domain/orders/fixtures";
import { filterOrders, pageWindow, paginate } from "@/domain/orders/rules";

/* Bornes d'une page (partagées avec la pagination SQL) et filtre par personne. */
describe("pageWindow", () => {
  it("ramène le numéro dans [1, pageCount] et donne le rang du premier élément", () => {
    expect(pageWindow(95, 1, 40)).toEqual({ page: 1, pageCount: 3, offset: 0 });
    expect(pageWindow(95, 3, 40)).toEqual({
      page: 3,
      pageCount: 3,
      offset: 80,
    });
    expect(pageWindow(95, 99, 40)).toEqual({
      page: 3,
      pageCount: 3,
      offset: 80,
    });
    expect(pageWindow(0, 5, 40)).toEqual({ page: 1, pageCount: 1, offset: 0 });
    expect(pageWindow(10, Number.NaN, 40).page).toBe(1);
  });

  it("paginate découpe selon les mêmes bornes", () => {
    const items = Array.from({ length: 95 }, (_, i) => i);
    const last = paginate(items, 99, 40);
    expect(last).toMatchObject({ page: 3, pageCount: 3, total: 95 });
    expect(last.items).toEqual(items.slice(80));
  });
});

describe("filterOrders : staffId", () => {
  it("garde les commandes où la personne est préparateur ou livreur", () => {
    const julien = filterOrders(scenarioOrders, { staffId: "stf-0005" });
    expect(julien.length).toBeGreaterThan(0);
    expect(
      julien.every(
        (o) => o.preparer?.id === "stf-0005" || o.driver?.id === "stf-0005",
      ),
    ).toBe(true);
    const malik = filterOrders(scenarioOrders, { staffId: "stf-0001" });
    expect(malik.every((o) => o.driver?.id === "stf-0001")).toBe(true);
    expect(filterOrders(scenarioOrders, { staffId: "stf-9999" })).toEqual([]);
  });
});
