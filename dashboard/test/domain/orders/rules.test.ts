import { describe, expect, it } from "vitest";
import { scenarioOrders } from "@/domain/orders/fixtures";
import {
  computeOrderTotalCents,
  filterOrders,
  hasOrderFilters,
  orderFiltersQuery,
  paginate,
  sortOrdersBySlot,
} from "@/domain/orders/rules";
import { parseOrderFilters } from "@/domain/orders/schemas";
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

  it("par période d'un jour, compare au jour de livraison, pas à createdAt", () => {
    const result = filterOrders(scenarioOrders, {
      from: "2026-09-08",
      to: "2026-09-08",
    });
    expect(result).toHaveLength(5);
    expect(result.every((o) => o.deliverySlot.date === "2026-09-08")).toBe(
      true,
    );
  });

  it("cumule statut et date (ET, pas OU)", () => {
    const result = filterOrders(scenarioOrders, {
      status: "pending",
      from: "2026-09-08",
      to: "2026-09-08",
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
      filterOrders(scenarioOrders, {
        status: "delivered",
        from: "2026-09-08",
        to: "2026-09-08",
      }),
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
      filterOrders(scenarioOrders, { from: "2026-09-07", to: "2026-09-07" }),
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

const sortedIds = (orders: readonly Order[]) => ids(orders).sort();

describe("filterOrders : période, recherche et équipe", () => {
  it("borne le jour de livraison, bornes incluses, chaque borne seule", () => {
    expect(
      filterOrders(scenarioOrders, { from: "2026-09-07", to: "2026-09-08" }),
    ).toHaveLength(10);
    expect(filterOrders(scenarioOrders, { from: "2026-09-08" })).toHaveLength(
      5,
    );
    expect(filterOrders(scenarioOrders, { to: "2026-09-06" })).toHaveLength(4);
  });

  it("cherche dans la référence, sans tenir compte de la casse", () => {
    expect(
      sortedIds(filterOrders(scenarioOrders, { query: "fig-260906" })),
    ).toEqual(["cmd-0005", "cmd-0006", "cmd-0007", "cmd-0008"]);
  });

  it("cherche le nom sans accents ni majuscules, et l'e-mail", () => {
    expect(
      ids(filterOrders(scenarioOrders, { query: "ELISE moreau" })),
    ).toEqual(["cmd-0009"]);
    expect(ids(filterOrders(scenarioOrders, { query: "Lefevre" }))).toEqual([
      "cmd-0004",
    ]);
    expect(
      ids(filterOrders(scenarioOrders, { query: "chloe.dasilva@" })),
    ).toEqual(["cmd-0011"]);
  });

  it("cherche les chiffres du téléphone, la ville et le code postal", () => {
    expect(ids(filterOrders(scenarioOrders, { query: "00 07" }))).toEqual([
      "cmd-0007",
    ]);
    expect(ids(filterOrders(scenarioOrders, { query: "Bagnolet" }))).toEqual([
      "cmd-0010",
    ]);
    expect(ids(filterOrders(scenarioOrders, { query: "93100" }))).toEqual([
      "cmd-0003",
    ]);
  });

  it("une recherche vide ne filtre rien", () => {
    expect(filterOrders(scenarioOrders, { query: "   " })).toHaveLength(
      scenarioOrders.length,
    );
  });

  it("filtre par préparateur ou livreur ; null garde les commandes sans personne", () => {
    expect(
      sortedIds(filterOrders(scenarioOrders, { preparerId: "stf-0005" })),
    ).toEqual(["cmd-0003", "cmd-0005", "cmd-0007", "cmd-0014"]);
    expect(
      sortedIds(filterOrders(scenarioOrders, { driverId: "stf-0001" })),
    ).toEqual(["cmd-0004", "cmd-0007", "cmd-0008", "cmd-0014"]);
    const unprepared = filterOrders(scenarioOrders, { preparerId: null });
    expect(unprepared).toHaveLength(8);
    expect(unprepared.every((o) => o.preparer === null)).toBe(true);
    expect(filterOrders(scenarioOrders, { driverId: null })).toHaveLength(9);
  });

  it("cumule recherche et équipe (ET, pas OU)", () => {
    expect(
      ids(
        filterOrders(scenarioOrders, {
          query: "gauthier",
          driverId: "stf-0002",
        }),
      ),
    ).toEqual(["cmd-0005"]);
  });
});

describe("hasOrderFilters / orderFiltersQuery", () => {
  it("ne compte que les filtres de la barre", () => {
    expect(hasOrderFilters({})).toBe(false);
    expect(
      hasOrderFilters({ customerId: "cli-0001", communityId: "com-0001" }),
    ).toBe(false);
    expect(hasOrderFilters({ driverId: null })).toBe(true);
    expect(hasOrderFilters({ query: "benali" })).toBe(true);
  });

  it("écrit les clés d'URL françaises, que parseOrderFilters relit à l'identique", () => {
    const filters = {
      query: "amel benali",
      status: "pending",
      from: "2026-09-01",
      to: "2026-09-07",
      preparerId: "stf-0005",
      driverId: null,
    } as const;
    const query = orderFiltersQuery({ ...filters, customerId: "cli-0001" });
    expect(query).toBe(
      "q=amel+benali&statut=pending&du=2026-09-01&au=2026-09-07&preparateur=stf-0005&livreur=aucun",
    );
    expect(
      parseOrderFilters(Object.fromEntries(new URLSearchParams(query))),
    ).toEqual(filters);
    expect(orderFiltersQuery({})).toBe("");
  });
});
