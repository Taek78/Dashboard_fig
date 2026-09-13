import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_EVENT_AT,
  MOCK_LATENCY_MS,
  ordersMock,
  resetOrdersMock,
} from "@/data/orders.mock";
import { ordersFixtures } from "@/domain/orders/fixtures";
import type { OrderStatus } from "@/domain/orders/status";

const ACTOR = { id: "usr-test", name: "Testeur" };
const change = (from: OrderStatus, to: OrderStatus) => ({
  from,
  to,
  actor: ACTOR,
  cancellation: null,
});

/*
 * Timers factices : on n'attend pas réellement les 400 ms de latence simulée,
 * on avance l'horloge à la main. resetOrdersMock() avant chaque cas : le store est
 * un singleton de module, une écriture dans un test ne doit pas fuir dans le suivant.
 */
beforeEach(() => {
  vi.useFakeTimers();
  resetOrdersMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
  return promise;
}

describe("ordersMock.getOrders", () => {
  it("renvoie toutes les fixtures, triées par créneau, après la latence simulée", async () => {
    const orders = await settle(ordersMock.getOrders());
    expect(orders).toHaveLength(ordersFixtures.length);
    expect(orders[0]?.id).toBe("cmd-0007");
    expect(orders.at(-1)?.id).toBe("cmd-0012");
  });

  it("applique les filtres reçus", async () => {
    const pending = await settle(ordersMock.getOrders({ status: "pending" }));
    expect(pending).toHaveLength(3);
    expect(pending.every((o) => o.status === "pending")).toBe(true);

    const both = await settle(
      ordersMock.getOrders({ status: "pending", date: "2026-09-08" }),
    );
    expect(both.map((o) => o.id)).toEqual(["cmd-0009", "cmd-0010"]);
  });

  it("renvoie des copies : muter le résultat ne touche ni le store ni les fixtures", async () => {
    const orders = await settle(ordersMock.getOrders());
    const first = orders.find((o) => o.id === "cmd-0001")!;
    first.status = "cancelled";
    first.lines.push({
      productId: "prd-x",
      productName: "Intrus",
      quantity: 1,
      unit: "piece",
      lineTotalCents: 1,
    });
    const again = await settle(ordersMock.getOrder("cmd-0001"));
    expect(again?.status).toBe("pending");
    expect(again?.lines).toHaveLength(3);
    expect(ordersFixtures[0].status).toBe("pending");
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
    const again = await settle(ordersMock.getOrder("cmd-0001"));
    expect(again?.customer.fullName).toBe("Amel Benali");
    expect(ordersFixtures[0].customer.fullName).toBe("Amel Benali");
  });
});

describe("ordersMock.updateOrderStatus", () => {
  it("écrit le nouveau statut et le rend visible par getOrder et getOrders", async () => {
    const updated = await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    expect(updated?.status).toBe("confirmed");

    const byId = await settle(ordersMock.getOrder("cmd-0001"));
    expect(byId?.status).toBe("confirmed");

    const confirmed = await settle(
      ordersMock.getOrders({ status: "confirmed" }),
    );
    expect(confirmed.map((o) => o.id)).toContain("cmd-0001");
  });

  it("renvoie null pour un id inconnu", async () => {
    expect(
      await settle(
        ordersMock.updateOrderStatus(
          "cmd-9999",
          change("pending", "confirmed"),
        ),
      ),
    ).toBeNull();
  });

  it("renvoie null si le statut attendu (from) ne correspond plus, sans rien écrire", async () => {
    await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    const stale = await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "cancelled")),
    );
    expect(stale).toBeNull();
    const order = await settle(ordersMock.getOrder("cmd-0001"));
    expect(order?.status).toBe("confirmed");
  });

  it("renvoie une copie : la muter ne change pas le store", async () => {
    const updated = await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    updated!.status = "delivered";
    const order = await settle(ordersMock.getOrder("cmd-0001"));
    expect(order?.status).toBe("confirmed");
  });

  it("ne modifie jamais les fixtures", async () => {
    await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    expect(ordersFixtures[0].status).toBe("pending");
  });

  it("n'applique pas la règle métier : pending → delivered passe (la règle vit dans l'action)", async () => {
    const updated = await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "delivered")),
    );
    expect(updated?.status).toBe("delivered");
  });
});

describe("ordersMock.getOrderEvents", () => {
  it("relit l'historique des fixtures, du plus récent au plus ancien", async () => {
    const list = await settle(ordersMock.getOrderEvents("cmd-0002"));
    expect(list.map((e) => e.to)).toEqual(["confirmed"]);
    expect(await settle(ordersMock.getOrderEvents("cmd-0001"))).toEqual([]);
    expect(await settle(ordersMock.getOrderEvents("cmd-9999"))).toEqual([]);
  });

  it("un changement de statut réussi ajoute un événement portant l'acteur", async () => {
    await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "cancelled")),
    );
    const list = await settle(ordersMock.getOrderEvents("cmd-0001"));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      orderId: "cmd-0001",
      from: "pending",
      to: "confirmed",
      actor: ACTOR,
      at: MOCK_EVENT_AT,
    });
    list[0]!.actor.name = "modifié";
    const again = await settle(ordersMock.getOrderEvents("cmd-0001"));
    expect(again[0]?.actor.name).toBe("Testeur");
  });
});

describe("ordersMock.updateOrderStatus : annulation", () => {
  it("stocke le motif sur la commande et dans l'événement", async () => {
    const cancellation = { reason: "other" as const, detail: "Client absent" };
    const updated = await settle(
      ordersMock.updateOrderStatus("cmd-0001", {
        ...change("pending", "cancelled"),
        cancellation,
      }),
    );
    expect(updated?.cancellation).toEqual(cancellation);
    const [event] = await settle(ordersMock.getOrderEvents("cmd-0001"));
    expect(event?.cancellation).toEqual(cancellation);
    const confirmed = await settle(
      ordersMock.updateOrderStatus("cmd-0009", change("pending", "confirmed")),
    );
    expect(confirmed?.cancellation).toBeNull();
  });
});

describe("resetOrdersMock", () => {
  it("restaure l'état initial après une écriture", async () => {
    await settle(
      ordersMock.updateOrderStatus("cmd-0001", change("pending", "confirmed")),
    );
    resetOrdersMock();
    const order = await settle(ordersMock.getOrder("cmd-0001"));
    expect(order?.status).toBe("pending");
  });
});
