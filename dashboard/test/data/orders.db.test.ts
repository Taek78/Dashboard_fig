import { describe, expect, it, vi } from "vitest";
import { directoryStatsFromOrders } from "@/domain/customers/directory";
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
import { summarizeStaffWork } from "@/domain/staff/rules";
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
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { ordersDb } = await import("@/data/orders.db");

const ACTOR = { id: "usr-0002", name: "Gestion E2E" };
const change = (from: OrderStatus, to: OrderStatus) => ({
  from,
  to,
  actor: ACTOR,
  cancellation: null,
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

  it("getDirectoryStats : mêmes chiffres et séries de fidélité que directoryStatsFromOrders", async () => {
    const all = await ordersDb.getOrders();
    const fromDb = await ordersDb.getDirectoryStats();
    const expected = directoryStatsFromOrders(all);
    expect(Object.fromEntries(fromDb.customers)).toEqual(
      Object.fromEntries(expected.customers),
    );
    expect(Object.fromEntries(fromDb.communities)).toEqual(
      Object.fromEntries(expected.communities),
    );
    expect(Object.fromEntries(fromDb.loyaltyStreaks)).toEqual(
      Object.fromEntries(expected.loyaltyStreaks),
    );
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
