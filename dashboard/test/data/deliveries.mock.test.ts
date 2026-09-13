import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELIVERIES_MOCK_LATENCY_MS,
  deliveriesMock,
  resetDeliveriesMock,
} from "@/data/deliveries.mock";
import { assignmentsFixtures } from "@/domain/deliveries/fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  resetDeliveriesMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(DELIVERIES_MOCK_LATENCY_MS);
  return promise;
}

describe("deliveriesMock", () => {
  it("getCouriers renvoie les trois livreurs en copie", async () => {
    const couriers = await settle(deliveriesMock.getCouriers());
    expect(couriers).toHaveLength(3);
    couriers[0]!.name = "Modifié";
    const again = await settle(deliveriesMock.getCouriers());
    expect(again[0]!.name).toBe("Karim Haddad");
  });

  it("getAssignments filtre par jour, tout sans argument", async () => {
    expect(await settle(deliveriesMock.getAssignments())).toHaveLength(
      assignmentsFixtures.length,
    );
    const day = await settle(deliveriesMock.getAssignments("2026-09-07"));
    expect(day.map((a) => a.orderId).sort()).toEqual(["cmd-0004", "cmd-0014"]);
  });

  it("assignOrder ajoute puis remplace l'attribution d'une commande", async () => {
    const a = {
      orderId: "cmd-0002",
      courierId: "crs-0002",
      date: "2026-09-07",
      start: "09:00",
      end: "11:00",
    };
    await settle(deliveriesMock.assignOrder(a));
    let day = await settle(deliveriesMock.getAssignments("2026-09-07"));
    expect(day.find((x) => x.orderId === "cmd-0002")?.courierId).toBe(
      "crs-0002",
    );

    await settle(deliveriesMock.assignOrder({ ...a, courierId: "crs-0003" }));
    day = await settle(deliveriesMock.getAssignments("2026-09-07"));
    expect(day.filter((x) => x.orderId === "cmd-0002")).toHaveLength(1);
    expect(day.find((x) => x.orderId === "cmd-0002")?.courierId).toBe(
      "crs-0003",
    );
  });

  it("resetDeliveriesMock efface les écritures et ne touche pas les fixtures", async () => {
    await settle(
      deliveriesMock.assignOrder({
        orderId: "cmd-0002",
        courierId: "crs-0002",
        date: "2026-09-07",
        start: "09:00",
        end: "11:00",
      }),
    );
    resetDeliveriesMock();
    const day = await settle(deliveriesMock.getAssignments("2026-09-07"));
    expect(day.some((x) => x.orderId === "cmd-0002")).toBe(false);
    expect(assignmentsFixtures).toHaveLength(5);
  });
});
