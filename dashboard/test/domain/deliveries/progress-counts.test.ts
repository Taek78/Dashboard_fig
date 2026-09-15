import { describe, expect, it } from "vitest";
import {
  tourProgress,
  tourProgressFromCounts,
} from "@/domain/deliveries/rules";
import { scenarioOrders } from "@/domain/orders/fixtures";

/* Avancement à partir des totaux par statut (tableau de bord, agrégés par la base). */
describe("tourProgressFromCounts", () => {
  it("donne le même avancement que le calcul sur les commandes", () => {
    const counts: Record<string, number> = {};
    for (const o of scenarioOrders)
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    expect(tourProgressFromCounts(counts)).toEqual(
      tourProgress(scenarioOrders),
    );
  });

  it("ignore les statuts absents et n'affiche que les segments non vides", () => {
    expect(tourProgressFromCounts({ delivered: 3, preparing: 1 })).toEqual({
      total: 4,
      done: 3,
      remaining: 1,
      percentDone: 75,
      segments: [
        { status: "delivered", count: 3 },
        { status: "preparing", count: 1 },
      ],
    });
    expect(tourProgressFromCounts({}).total).toBe(0);
  });
});
