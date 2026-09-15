import { afterAll, describe, expect, it, vi } from "vitest";
import type { OrderFilters } from "@/domain/orders/types";

/*
 * Tests de CONTRAT : la même question posée au mock et à PostgreSQL doit
 * recevoir la même réponse (mêmes commandes, dans le même ordre, mêmes
 * objets). Ils détectent une dérive entre les deux implémentations d'un
 * contrat, par exemple un filtre SQL qui ne dit pas la même chose que la règle
 * pure.
 *
 * Ne tournent que si TEST_DATABASE_URL pointe vers une base MIGRÉE et SEEDÉE
 * avec les fixtures (npm run db:migrate && npm run db:seed) : en CI, la base
 * éphémère du job e2e ; en local, une base dédiée, jamais la base de travail
 * (la comparaison exige les fixtures d'origine). Sans la variable : ignorés.
 * Les écritures sont restaurées à la fin de chaque cas.
 *
 * Exception documentée à la règle « les tests n'importent jamais une
 * implémentation db » : c'est précisément ce qu'on compare.
 */
const url = process.env.TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATA_SOURCE: "db",
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  }),
}));

const { ordersMock } = await import("@/data/orders.mock");
const { ordersDb } = await import("@/data/orders.db");
const { loginAttemptsDb } = await import("@/data/login-attempts.db");
const { EMAIL_POLICY } = await import("@/lib/rate-limit");

const ids = (orders: readonly { id: string }[]) => orders.map((o) => o.id);

afterAll(async () => {
  const pool = (globalThis as { figSql?: { end(): Promise<void> } }).figSql;
  await pool?.end();
});

describe.skipIf(!url)("contrat des commandes : mock = PostgreSQL", () => {
  const WEEK = { from: "2026-09-05", to: "2026-09-09" };
  const cases: [string, OrderFilters][] = [
    ["sans filtre", {}],
    ["statut", { status: "pending" }],
    ["période", WEEK],
    ["un seul jour", { from: "2026-09-07", to: "2026-09-07" }],
    ["préparateur", { ...WEEK, preparerId: "stf-0005" }],
    ["sans livreur", { ...WEEK, driverId: null }],
    ["client", { customerId: "cli-0001" }],
    ["communauté", { communityId: "com-0001" }],
    ["recherche par nom", { query: "benali" }],
    ["recherche par téléphone", { query: "00 07" }],
    [
      "recherche par référence et statut",
      { query: "260907", status: "preparing" },
    ],
  ];

  it.each(cases)(
    "getOrders : %s",
    async (_name, filters) => {
      const [mock, db] = await Promise.all([
        ordersMock.getOrders(filters),
        ordersDb.getOrders(filters),
      ]);
      expect(ids(db)).toEqual(ids(mock));
    },
    30_000,
  );

  it("getOrder : la même commande complète (lignes, remise, équipe, communauté)", async () => {
    const week = await ordersMock.getOrders(WEEK);
    for (const { id } of week) {
      const [mock, db] = await Promise.all([
        ordersMock.getOrder(id),
        ordersDb.getOrder(id),
      ]);
      expect(db).toEqual(mock);
    }
  }, 60_000);

  it("assignStaff : rien d'écrit sur une commande terminée ou si la précondition ne tient plus", async () => {
    const delivered = (await ordersDb.getOrders({ status: "delivered" }))[0]!;
    const malik = { id: "stf-0001", name: "Malik Dembélé" };
    expect(
      await ordersDb.assignStaff(delivered.id, {
        role: "driver",
        staff: malik,
      }),
    ).toBeNull();

    const pending = (await ordersDb.getOrders({ status: "pending" }))[0]!;
    const original = pending.driver;
    expect(
      await ordersDb.assignStaff(pending.id, {
        role: "driver",
        staff: malik,
        expectedStaffId: "stf-9999",
      }),
    ).toBeNull();
    expect((await ordersDb.getOrder(pending.id))?.driver).toEqual(original);

    try {
      const updated = await ordersDb.assignStaff(pending.id, {
        role: "driver",
        staff: malik,
        expectedStaffId: original?.id ?? null,
      });
      expect(updated?.driver).toEqual(malik);
    } finally {
      await ordersDb.assignStaff(pending.id, {
        role: "driver",
        staff: original,
      });
    }
  }, 30_000);
});

describe.skipIf(!url)("limitation de débit : table login_attempts", () => {
  const key = `email:contrat-${Date.now()}@fig-demo.invalid`;
  const entry = { key, policy: EMAIL_POLICY };

  afterAll(() => loginAttemptsDb.clear([key]));

  it("compte des échecs simultanés sans en perdre (verrou de ligne)", async () => {
    const now = Date.now();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        loginAttemptsDb.recordFailure([entry], now),
      ),
    );
    const state = (await loginAttemptsDb.read([key])).get(key);
    expect(state?.failures).toBe(8);
    expect(state?.lockedUntil).not.toBeNull();
  }, 30_000);

  it("clear efface la clé", async () => {
    await loginAttemptsDb.clear([key]);
    expect((await loginAttemptsDb.read([key])).size).toBe(0);
  });
});
