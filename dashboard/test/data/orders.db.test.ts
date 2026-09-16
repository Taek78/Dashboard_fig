import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "@/db/client";
import { customerNotifications, orders as ordersTable } from "@/db/schema";
import { directoryStatsFromOrders } from "@/domain/customers/directory";
import { customersFixtures } from "@/domain/customers/fixtures";
import { loyalTierEvents } from "@/domain/customers/tier";
import {
  filterByRange,
  orderStats,
  revenueSeries,
  topProducts,
} from "@/domain/metrics/rules";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  filterOrders,
  paginate,
  sortOrdersBySlot,
} from "@/domain/orders/rules";
import { staffFixtures } from "@/domain/staff/fixtures";
import {
  filterStaffHistory,
  staffHistoryOrderFilters,
  summarizeStaffWork,
  type StaffHistoryFilters,
} from "@/domain/staff/rules";
import type { OrderStatus } from "@/domain/orders/status";
import type { OrderFilters } from "@/domain/orders/types";

/*
 * Commandes sur la base de TEST (seedée avec les fixtures), chaque test dans
 * une transaction annulée. Les filtres SQL sont comparés à la règle pure
 * filterOrders appliquée à toutes les commandes : un filtre SQL qui ne dirait
 * plus la même chose que le domaine est détecté ici.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { ordersDb } = await import("@/data/orders.db");

/** Les chiffres de l'annuaire, comparés champ à champ (Map → objet). */
function expectDirectoryStats(
  fromDb: Awaited<ReturnType<typeof ordersDb.getDirectoryStats>>,
  expected: ReturnType<typeof directoryStatsFromOrders>,
) {
  for (const key of [
    "customers",
    "communities",
    "loyaltyCounts",
    "loyalSince",
    "memberCounts",
  ] as const) {
    expect(Object.fromEntries(fromDb[key])).toEqual(
      Object.fromEntries(expected[key]),
    );
  }
}

const ACTOR = { id: "usr-0002", name: "Gestion E2E" };
const change = (from: OrderStatus, to: OrderStatus) => ({
  from,
  to,
  actor: ACTOR,
  cancellation: null,
  notification: null,
});
const ids = (orders: readonly { id: string }[]) => orders.map((o) => o.id);
const malik = { id: "stf-0001", name: "Malik Dembélé" };

describe("ordersDb.getOrders", () => {
  it("renvoie toutes les commandes seedées, triées par créneau puis référence", async () => {
    const orders = await ordersDb.getOrders();
    expect(orders).toHaveLength(ordersFixtures.length);
    expect(ids(orders)).toEqual(ids(sortOrdersBySlot(orders)));
    const day6 = orders.filter((o) => o.deliverySlot.date === "2026-09-06");
    expect(day6[0]?.id).toBe("cmd-0007");
  });

  it("chaque filtre SQL donne exactement la règle pure du domaine", async () => {
    const all = await ordersDb.getOrders();
    const WEEK = { from: "2026-09-05", to: "2026-09-09" };
    const cases: OrderFilters[] = [
      { status: "preparing" },
      { status: "cancelled", ...WEEK },
      WEEK,
      { from: "2026-09-07", to: "2026-09-07" },
      { ...WEEK, preparerId: "stf-0005" },
      { ...WEEK, driverId: null },
      { customerId: "cli-0001" },
      { customerId: "cli-0001", ...WEEK },
      { customerId: "cli-0001", from: "2026-09-08" },
      { communityId: "com-0001" },
      { query: "benali" },
      { query: "00 07" },
      { query: "260907", status: "preparing" },
    ];
    for (const filters of cases) {
      expect(ids(await ordersDb.getOrders(filters))).toEqual(
        ids(sortOrdersBySlot(filterOrders(all, filters))),
      );
    }
    expect(
      ids(
        await ordersDb.getOrders({
          query: "benali",
          from: "2026-09-05",
          to: "2026-09-09",
        }),
      ),
    ).toEqual(["cmd-0001", "cmd-0012"]);
  });
});

describe("pagination et agrégats SQL = règles pures", () => {
  const MONTH = { from: "2026-09-01", to: "2026-09-30" };
  const YEAR = { from: "2026-01-01", to: "2026-12-31" };

  it("getOrdersPage : même page que paginate, les plus récentes d'abord, recherche comprise", async () => {
    const all = await ordersDb.getOrders();
    const cases: [OrderFilters, number][] = [
      [{}, 1],
      [{}, 40],
      [{}, 9999],
      [{ status: "preparing" }, 1],
      [{ query: "benali" }, 1],
      [{ query: "ÉLISE moreau" }, 1],
      [{ query: "elise" }, 1],
      [{ query: "00 07", status: "delivered" }, 2],
      [{ query: "introuvable" }, 1],
    ];
    for (const [filters, n] of cases) {
      const expected = paginate(
        sortOrdersBySlot(filterOrders(all, filters), "desc"),
        n,
      );
      const page = await ordersDb.getOrdersPage(filters, n);
      expect({ ...page, items: ids(page.items) }).toEqual({
        ...expected,
        items: ids(expected.items),
      });
    }
  });

  it("getOrders({ staffId }) : commandes où la personne est préparateur ou livreur", async () => {
    const all = await ordersDb.getOrders();
    for (const staffId of ["stf-0001", "stf-0005", "stf-0010"]) {
      expect(ids(await ordersDb.getOrders({ staffId }))).toEqual(
        ids(filterOrders(all, { staffId })),
      );
    }
  });

  it("getOrderStats : mêmes chiffres qu'orderStats sur la période", async () => {
    const all = await ordersDb.getOrders();
    for (const range of [
      MONTH,
      YEAR,
      { from: "2025-01-01", to: "2026-12-31" },
      { from: "2030-01-01", to: "2030-01-31" },
    ]) {
      expect(await ordersDb.getOrderStats(range)).toEqual(
        orderStats(filterByRange(all, range)),
      );
    }
  });

  it("getOrderSeries : même série que revenueSeries, par jour, semaine et mois", async () => {
    const all = await ordersDb.getOrders();
    const cases = [
      [MONTH, "day"],
      [{ from: "2026-06-16", to: "2026-09-13" }, "week"],
      [{ from: "2025-01-01", to: "2025-12-31" }, "month"],
    ] as const;
    for (const [range, bucket] of cases) {
      expect(await ordersDb.getOrderSeries(range, bucket)).toEqual(
        revenueSeries(all, range, bucket),
      );
    }
  });

  it("getTopProducts : même classement que topProducts", async () => {
    const all = await ordersDb.getOrders();
    for (const range of [MONTH, YEAR]) {
      for (const limit of [5, 100]) {
        expect(await ordersDb.getTopProducts(range, limit)).toEqual(
          topProducts(filterByRange(all, range), limit),
        );
      }
    }
  });

  it("getStaffWorkSummaries : mêmes compteurs que summarizeStaffWork", async () => {
    const all = await ordersDb.getOrders();
    const summaries = await ordersDb.getStaffWorkSummaries();
    for (const member of staffFixtures) {
      expect(
        summaries.get(member.id) ?? summarizeStaffWork([], member.id),
      ).toEqual(summarizeStaffWork(all, member.id));
    }
  });

  it("getDirectoryStats : mêmes chiffres, compteurs fidélité, dates d'atteinte et membres que directoryStatsFromOrders", async () => {
    const all = await ordersDb.getOrders();
    const fromDb = await ordersDb.getDirectoryStats();
    const expected = directoryStatsFromOrders(all, customersFixtures);
    expectDirectoryStats(fromDb, expected);
    expect(fromDb.loyalSince.size).toBeGreaterThan(5);
    expect(fromDb.memberCounts.size).toBe(3);
  });

  it("getCustomerTierEvents : même historique d'atteintes que loyalTierEvents", async () => {
    const all = await ordersDb.getOrders();
    const ids = [...new Set(all.map((o) => o.customer.id))];
    let withEvents = 0;
    for (const id of ids.slice(0, 40)) {
      const expected = loyalTierEvents(all.filter((o) => o.customer.id === id));
      expect(await ordersDb.getCustomerTierEvents(id)).toEqual(expected);
      if (expected.length > 0) withEvents += 1;
    }
    expect(withEvents).toBeGreaterThan(0);
    expect(await ordersDb.getCustomerTierEvents("cli-9999")).toEqual([]);
  });
});

describe("lectures bornées et agrégats ciblés = règles pures", () => {
  it("getOrders avec limit : les premières par créneau ; countOrders : le total filtré", async () => {
    const all = await ordersDb.getOrders();
    const preparing = sortOrdersBySlot(
      filterOrders(all, { status: "preparing" }),
    );
    expect(
      ids(await ordersDb.getOrders({ status: "preparing" }, { limit: 3 })),
    ).toEqual(ids(preparing.slice(0, 3)));
    expect(await ordersDb.countOrders({ status: "preparing" })).toBe(
      preparing.length,
    );
    expect(await ordersDb.countOrders({ query: "benali" })).toBe(
      filterOrders(all, { query: "benali" }).length,
    );
    expect(await ordersDb.countOrders({})).toBe(all.length);
  });

  it("recherche : caractères spéciaux de LIKE, ligatures, casse et téléphone comme la règle pure", async () => {
    const all = await ordersDb.getOrders();
    for (const query of [
      "100%",
      "a_b",
      "%",
      "_",
      "\\",
      "fig-2609",
      "PARIS",
      "06 39",
      "œ",
      "é",
    ]) {
      expect(ids(await ordersDb.getOrders({ query }))).toEqual(
        ids(sortOrdersBySlot(filterOrders(all, { query }))),
      );
    }
  });

  it("getDeliveryDayCounts : le nombre de livraisons de chaque jour", async () => {
    const all = await ordersDb.getOrders();
    const range = { from: "2026-09-01", to: "2026-09-15" };
    const expected = new Map<string, number>();
    for (const o of filterByRange(all, range)) {
      const date = o.deliverySlot.date;
      expected.set(date, (expected.get(date) ?? 0) + 1);
    }
    expect(
      Object.fromEntries(await ordersDb.getDeliveryDayCounts(range)),
    ).toEqual(Object.fromEntries(expected));
  });

  it("getStaffWorkSummary et l'historique paginé d'une personne", async () => {
    const all = await ordersDb.getOrders();
    for (const member of staffFixtures) {
      expect(await ordersDb.getStaffWorkSummary(member.id)).toEqual(
        summarizeStaffWork(all, member.id),
      );
    }
    const cases: StaffHistoryFilters[] = [
      {},
      { role: "livraison" },
      { role: "preparation", query: "FIG-260906" },
      { status: "delivered", from: "2026-01-01", to: "2026-06-30" },
    ];
    for (const staffId of ["stf-0001", "stf-0005"]) {
      for (const filters of cases) {
        const expected = paginate(filterStaffHistory(all, staffId, filters), 2);
        const page = await ordersDb.getOrdersPage(
          staffHistoryOrderFilters(staffId, filters),
          2,
        );
        expect({ ...page, items: ids(page.items) }).toEqual({
          ...expected,
          items: ids(expected.items),
        });
      }
    }
  });

  it("getDirectoryStats restreint à un client ou à une communauté", async () => {
    const all = await ordersDb.getOrders();
    for (const scope of [
      { customerId: "cli-0001" },
      { communityId: "com-0001" },
      { customerId: "cli-9999" },
    ]) {
      const fromDb = await ordersDb.getDirectoryStats(scope);
      // Les membres se comptent toujours sur toute la base.
      const expected = directoryStatsFromOrders(
        filterOrders(all, scope),
        customersFixtures,
      );
      expectDirectoryStats(fromDb, expected);
    }
  });
});

/**
 * Nom de la contrainte PostgreSQL qui a refusé l'écriture, sinon null. Chaque
 * essai tourne dans sa propre sous-transaction (point de sauvegarde) : une
 * écriture refusée n'abandonne pas la transaction du test.
 */
async function refusedBy(
  write: (tx: DbExecutor) => Promise<unknown>,
): Promise<string | null> {
  try {
    await testDb().transaction((tx) => write(tx));
    return null;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? "erreur sans contrainte";
  }
}

describe("contraintes de la base sur les commandes", () => {
  const draft = {
    reference: "FIG-TEST-001",
    customerId: "cli-0001",
    deliveryDate: "2026-09-10",
    deliveryStart: "14:00",
    deliveryEnd: "15:00",
    deliveryCity: "Paris",
    deliveryPostalCode: "75011",
    totalCents: 1000,
  };

  it("refuse un créneau qui n'est pas d'une heure pile", async () => {
    expect(
      await refusedBy((tx) =>
        tx
          .insert(ordersTable)
          .values({ ...draft, id: "cmd-test-2h", deliveryEnd: "16:00" }),
      ),
    ).toBe("orders_slot_one_hour");
    expect(
      await refusedBy((tx) =>
        tx.insert(ordersTable).values({
          ...draft,
          id: "cmd-test-30",
          deliveryStart: "14:30",
          deliveryEnd: "15:30",
        }),
      ),
    ).toBe("orders_slot_one_hour");
    expect(
      await refusedBy((tx) =>
        tx.insert(ordersTable).values({ ...draft, id: "cmd-test-ok" }),
      ),
    ).toBeNull();
  });

  it("refuse des frais de livraison à une commande de communauté, ou négatifs", async () => {
    expect(
      await refusedBy((tx) =>
        tx.insert(ordersTable).values({
          ...draft,
          id: "cmd-test-com",
          communityId: "com-0001",
          deliveryFeeCents: 190,
        }),
      ),
    ).toBe("orders_community_delivery_free");
    expect(
      await refusedBy((tx) =>
        tx
          .insert(ordersTable)
          .values({ ...draft, id: "cmd-test-neg", deliveryFeeCents: -1 }),
      ),
    ).toBe("orders_fee_non_negative");
  });
});

describe("ordersDb.getOrder", () => {
  it("relit une commande complète, identique aux fixtures", async () => {
    for (const id of ["cmd-0001", "cmd-0004", "cmd-0005", "cmd-0010"]) {
      expect(await ordersDb.getOrder(id)).toEqual(
        ordersFixtures.find((o) => o.id === id),
      );
    }
    expect(await ordersDb.getOrder("cmd-9999")).toBeNull();
  });
});

describe("ordersDb.updateOrderStatus", () => {
  it("écrit le statut, l'événement portant l'acteur, visibles ensuite", async () => {
    const updated = await ordersDb.updateOrderStatus(
      "cmd-0001",
      change("preparing", "delivering"),
    );
    expect(updated?.status).toBe("delivering");
    expect((await ordersDb.getOrder("cmd-0001"))?.status).toBe("delivering");
    expect(ids(await ordersDb.getOrders({ status: "delivering" }))).toContain(
      "cmd-0001",
    );
    const [event] = await ordersDb.getOrderEvents("cmd-0001");
    expect(event).toMatchObject({
      orderId: "cmd-0001",
      from: "preparing",
      to: "delivering",
      actor: ACTOR,
      cancellation: null,
    });
  });

  it("conditionnelle : null si le statut attendu ne correspond plus, sans rien écrire", async () => {
    await ordersDb.updateOrderStatus(
      "cmd-0001",
      change("preparing", "delivering"),
    );
    expect(
      await ordersDb.updateOrderStatus(
        "cmd-0001",
        change("preparing", "cancelled"),
      ),
    ).toBeNull();
    expect((await ordersDb.getOrder("cmd-0001"))?.status).toBe("delivering");
    expect(await ordersDb.getOrderEvents("cmd-0001")).toHaveLength(1);
    expect(
      await ordersDb.updateOrderStatus(
        "cmd-9999",
        change("preparing", "delivering"),
      ),
    ).toBeNull();
  });

  it("annulation : motif sur la commande et dans l'événement ; la contrainte refuse un motif absent", async () => {
    const cancellation = { reason: "other" as const, detail: "Client absent" };
    const updated = await ordersDb.updateOrderStatus("cmd-0001", {
      ...change("preparing", "cancelled"),
      cancellation,
    });
    expect(updated?.cancellation).toEqual(cancellation);
    const [event] = await ordersDb.getOrderEvents("cmd-0001");
    expect(event?.cancellation).toEqual(cancellation);
    const shipped = await ordersDb.updateOrderStatus(
      "cmd-0009",
      change("preparing", "delivering"),
    );
    expect(shipped?.cancellation).toBeNull();
  });

  it("dépose la notification dans la même transaction, seulement si le client l'a autorisée", async () => {
    const draft = { title: "Commande FIG-260907-001", body: "En route." };
    // cli-0001 (Amel) a autorisé les notifications d'état.
    await ordersDb.updateOrderStatus("cmd-0001", {
      ...change("preparing", "delivering"),
      notification: draft,
    });
    const deposited = await testDb()
      .select()
      .from(customerNotifications)
      .where(eq(customerNotifications.orderId, "cmd-0001"));
    expect(deposited).toHaveLength(1);
    expect(deposited[0]).toMatchObject({
      customerId: "cli-0001",
      kind: "order_status",
      orderStatus: "delivering",
      title: draft.title,
      body: draft.body,
      sentAt: null,
    });

    // cli-0011 (Mathis) n'a rien autorisé : rien n'est déposé.
    await ordersDb.updateOrderStatus("cmd-0013", {
      ...change("cancelled", "preparing"),
      notification: draft,
    });
    expect(
      await testDb()
        .select()
        .from(customerNotifications)
        .where(eq(customerNotifications.orderId, "cmd-0013")),
    ).toEqual([]);

    // Sans notification à déposer, ou sur une écriture refusée : rien non plus.
    await ordersDb.updateOrderStatus(
      "cmd-0002",
      change("preparing", "delivering"),
    );
    await ordersDb.updateOrderStatus("cmd-0002", {
      ...change("preparing", "cancelled"),
      notification: draft,
    });
    expect(
      await testDb()
        .select()
        .from(customerNotifications)
        .where(eq(customerNotifications.orderId, "cmd-0002")),
    ).toEqual([]);
  });

  it("n'applique pas la règle métier : preparing → delivered passe (la règle vit dans l'action)", async () => {
    expect(
      (
        await ordersDb.updateOrderStatus(
          "cmd-0002",
          change("preparing", "delivered"),
        )
      )?.status,
    ).toBe("delivered");
  });
});

describe("ordersDb.getOrderEvents", () => {
  it("relit l'historique seedé, du plus récent au plus ancien", async () => {
    expect(
      (await ordersDb.getOrderEvents("cmd-0005")).map((e) => e.to),
    ).toEqual(["delivered", "delivering"]);
    expect(await ordersDb.getOrderEvents("cmd-0001")).toEqual([]);
    expect(await ordersDb.getOrderEvents("cmd-9999")).toEqual([]);
  });
});

describe("ordersDb.assignStaff (conditionnelle)", () => {
  it("n'écrit rien sur une commande terminée ou absente", async () => {
    expect(
      await ordersDb.assignStaff("cmd-0005", { role: "driver", staff: malik }),
    ).toBeNull();
    expect(
      await ordersDb.assignStaff("cmd-9999", { role: "driver", staff: malik }),
    ).toBeNull();
  });

  it("n'écrit rien si la personne affectée n'est plus celle attendue, écrit sinon", async () => {
    expect(
      await ordersDb.assignStaff("cmd-0003", {
        role: "preparer",
        staff: malik,
        expectedStaffId: null,
      }),
    ).toBeNull();
    expect((await ordersDb.getOrder("cmd-0003"))?.preparer?.id).toBe(
      "stf-0005",
    );
    const updated = await ordersDb.assignStaff("cmd-0001", {
      role: "driver",
      staff: malik,
      expectedStaffId: null,
    });
    expect(updated?.driver).toEqual(malik);
    expect(
      (
        await ordersDb.assignStaff("cmd-0001", {
          role: "driver",
          staff: null,
          expectedStaffId: "stf-0001",
        })
      )?.driver,
    ).toBeNull();
  });
});
