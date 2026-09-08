import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_LATENCY_MS, ordersMock } from "@/data/orders.mock";
import { ordersFixtures } from "@/domain/orders/fixtures";

/*
 * Timers factices : on n'attend pas réellement les 400 ms de latence simulée,
 * on avance l'horloge à la main.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
  return promise;
}

describe("ordersMock.getOrders", () => {
  it("renvoie toutes les fixtures après la latence simulée", async () => {
    const orders = await settle(ordersMock.getOrders());
    expect(orders).toHaveLength(ordersFixtures.length);
    expect(orders.map((o) => o.id)).toEqual(ordersFixtures.map((o) => o.id));
  });

  it("renvoie des copies : muter le résultat ne touche pas les fixtures", async () => {
    const orders = await settle(ordersMock.getOrders());
    orders[0].status = "cancelled";
    orders[0].lines.push({
      productId: "prd-x",
      productName: "Intrus",
      quantity: 1,
      unit: "piece",
      lineTotalCents: 1,
    });
    expect(ordersFixtures[0].status).toBe("pending");
    expect(ordersFixtures[0].lines).toHaveLength(3);
  });
});

describe("ordersMock.getOrder", () => {
  it("trouve une commande par id", async () => {
    const order = await settle(ordersMock.getOrder("cmd-0003"));
    expect(order?.reference).toBe("FIG-260907-003");
  });

  it("renvoie null pour un id inconnu", async () => {
    expect(await settle(ordersMock.getOrder("cmd-9999"))).toBeNull();
  });

  it("renvoie une copie indépendante", async () => {
    const order = await settle(ordersMock.getOrder("cmd-0001"));
    expect(order).not.toBeNull();
    order!.customer.fullName = "Modifié";
    expect(ordersFixtures[0].customer.fullName).toBe("Amel Benali");
  });
});
