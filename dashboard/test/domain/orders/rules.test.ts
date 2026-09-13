import { describe, expect, it } from "vitest";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  computeOrderTotalCents,
  filterOrders,
  sortOrdersBySlot,
} from "@/domain/orders/rules";
import { ORDER_STATUSES } from "@/domain/orders/status";
import type { Order, OrderLine } from "@/domain/orders/types";

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

/*
 * filterOrders et sortOrdersBySlot sont testées sur les fixtures réelles : les
 * comptes attendus (3 en attente, 5 le 2026-09-08…) sont ceux des 14 commandes.
 * Changer une fixture change ces nombres : c'est voulu, le test le signale.
 */
const ids = (orders: readonly Order[]) => orders.map((o) => o.id);

describe("filterOrders", () => {
  it("sans filtre, renvoie toutes les commandes dans le même ordre", () => {
    const result = filterOrders(ordersFixtures, {});
    expect(ids(result)).toEqual(ids(ordersFixtures));
  });

  it("par statut, renvoie exactement les commandes de ce statut", () => {
    const result = filterOrders(ordersFixtures, { status: "pending" });
    expect(result).toHaveLength(3);
    expect(result.every((o) => o.status === "pending")).toBe(true);
  });

  it("couvre chaque statut : la somme des filtres vaut le total", () => {
    const total = ORDER_STATUSES.reduce(
      (sum, status) => sum + filterOrders(ordersFixtures, { status }).length,
      0,
    );
    expect(total).toBe(ordersFixtures.length);
  });

  it("par date, compare au jour de livraison, pas à createdAt", () => {
    const result = filterOrders(ordersFixtures, { date: "2026-09-08" });
    expect(result).toHaveLength(5);
    expect(result.every((o) => o.deliverySlot.date === "2026-09-08")).toBe(
      true,
    );
  });

  it("cumule statut et date (ET, pas OU)", () => {
    const result = filterOrders(ordersFixtures, {
      status: "pending",
      date: "2026-09-08",
    });
    expect(ids(result)).toEqual(["cmd-0009", "cmd-0010"]);
  });

  it("renvoie [] quand rien ne correspond", () => {
    expect(
      filterOrders(ordersFixtures, { status: "delivered", date: "2026-09-08" }),
    ).toEqual([]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const before = ids(ordersFixtures);
    filterOrders(ordersFixtures, { status: "cancelled" });
    expect(ids(ordersFixtures)).toEqual(before);
  });
});

describe("sortOrdersBySlot", () => {
  it("place le créneau le plus tôt en premier et le plus tard en dernier", () => {
    const sorted = sortOrdersBySlot(ordersFixtures);
    expect(sorted[0]?.id).toBe("cmd-0007");
    expect(sorted.at(-1)?.id).toBe("cmd-0012");
  });

  it("trie par date, puis heure de début, puis référence", () => {
    const sorted = sortOrdersBySlot(ordersFixtures);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const key = (o: Order) =>
        `${o.deliverySlot.date} ${o.deliverySlot.start} ${o.reference}`;
      expect(key(prev) <= key(curr)).toBe(true);
    }
  });

  it("conserve toutes les commandes", () => {
    expect(sortOrdersBySlot(ordersFixtures)).toHaveLength(
      ordersFixtures.length,
    );
  });

  it("renvoie une copie et laisse l'entrée intacte", () => {
    const before = ids(ordersFixtures);
    const sorted = sortOrdersBySlot(ordersFixtures);
    expect(sorted).not.toBe(ordersFixtures);
    expect(ids(ordersFixtures)).toEqual(before);
  });

  it("se compose avec filterOrders comme le fera le mock", () => {
    const result = sortOrdersBySlot(
      filterOrders(ordersFixtures, { date: "2026-09-07" }),
    );
    expect(ids(result)).toEqual([
      "cmd-0001",
      "cmd-0002",
      "cmd-0014",
      "cmd-0003",
      "cmd-0004",
    ]);
  });
});
