import { describe, expect, it } from "vitest";
import { scenarioOrders } from "@/domain/orders/fixtures";
import {
  computeOrderTotalCents,
  filterOrders,
  paginate,
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

describe("computeOrderTotalCents avec remise", () => {
  it("déduit le montant de la remise, jamais sous zéro", () => {
    const lines = [line(1000), line(500)];
    expect(
      computeOrderTotalCents(lines, {
        kind: "community",
        percent: 10,
        amountCents: 150,
      }),
    ).toBe(1350);
    expect(
      computeOrderTotalCents(lines, {
        kind: "loyalty",
        percent: 15,
        amountCents: 99_999,
      }),
    ).toBe(0);
  });
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
    const result = filterOrders(scenarioOrders, {});
    expect(ids(result)).toEqual(ids(scenarioOrders));
  });

  it("par statut, renvoie exactement les commandes de ce statut", () => {
    const result = filterOrders(scenarioOrders, { status: "pending" });
    expect(result).toHaveLength(3);
    expect(result.every((o) => o.status === "pending")).toBe(true);
  });

  it("couvre chaque statut : la somme des filtres vaut le total", () => {
    const total = ORDER_STATUSES.reduce(
      (sum, status) => sum + filterOrders(scenarioOrders, { status }).length,
      0,
    );
    expect(total).toBe(scenarioOrders.length);
  });

  it("par date, compare au jour de livraison, pas à createdAt", () => {
    const result = filterOrders(scenarioOrders, { date: "2026-09-08" });
    expect(result).toHaveLength(5);
    expect(result.every((o) => o.deliverySlot.date === "2026-09-08")).toBe(
      true,
    );
  });

  it("cumule statut et date (ET, pas OU)", () => {
    const result = filterOrders(scenarioOrders, {
      status: "pending",
      date: "2026-09-08",
    });
    expect(ids(result)).toEqual(["cmd-0009", "cmd-0010"]);
  });

  it("par client, renvoie les commandes de cette personne", () => {
    const result = filterOrders(scenarioOrders, { customerId: "cli-0001" });
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((o) => o.customer.id === "cli-0001")).toBe(true);
  });

  it("renvoie [] quand rien ne correspond", () => {
    expect(
      filterOrders(scenarioOrders, { status: "delivered", date: "2026-09-08" }),
    ).toEqual([]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const before = ids(scenarioOrders);
    filterOrders(scenarioOrders, { status: "cancelled" });
    expect(ids(scenarioOrders)).toEqual(before);
  });
});

describe("sortOrdersBySlot", () => {
  it("place le créneau le plus tôt en premier et le plus tard en dernier", () => {
    const sorted = sortOrdersBySlot(scenarioOrders);
    expect(sorted[0]?.id).toBe("cmd-0007");
    expect(sorted.at(-1)?.id).toBe("cmd-0012");
  });

  it("trie par date, puis heure de début, puis référence", () => {
    const sorted = sortOrdersBySlot(scenarioOrders);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const key = (o: Order) =>
        `${o.deliverySlot.date} ${o.deliverySlot.start} ${o.reference}`;
      expect(key(prev) <= key(curr)).toBe(true);
    }
  });

  it("conserve toutes les commandes", () => {
    expect(sortOrdersBySlot(scenarioOrders)).toHaveLength(
      scenarioOrders.length,
    );
  });

  it("renvoie une copie et laisse l'entrée intacte", () => {
    const before = ids(scenarioOrders);
    const sorted = sortOrdersBySlot(scenarioOrders);
    expect(sorted).not.toBe(scenarioOrders);
    expect(ids(scenarioOrders)).toEqual(before);
  });

  it("se compose avec filterOrders comme le fera le mock", () => {
    const result = sortOrdersBySlot(
      filterOrders(scenarioOrders, { date: "2026-09-07" }),
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

describe("sortOrdersBySlot décroissant et paginate", () => {
  it("le sens décroissant inverse exactement l'ordre croissant", () => {
    const asc = sortOrdersBySlot(scenarioOrders).map((o) => o.id);
    const desc = sortOrdersBySlot(scenarioOrders, "desc").map((o) => o.id);
    expect(desc).toEqual([...asc].reverse());
  });

  it("paginate découpe et ramène un numéro hors bornes dans la plage", () => {
    const items = Array.from({ length: 95 }, (_, i) => i);
    expect(paginate(items, 1, 40)).toMatchObject({
      page: 1,
      pageCount: 3,
      total: 95,
    });
    expect(paginate(items, 1, 40).items).toHaveLength(40);
    expect(paginate(items, 3, 40).items).toEqual([
      80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
    ]);
    expect(paginate(items, 9, 40).page).toBe(3);
    expect(paginate(items, 0, 40).page).toBe(1);
    expect(paginate([], 4, 40)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    });
  });
});
