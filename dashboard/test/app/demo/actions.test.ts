import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import { customerMessages, orders } from "@/db/schema";

/*
 * Simulation d'une commande et d'un message (outils de démonstration, à
 * retirer avant la livraison) sur la base de test : écrit ce qu'il faut pour
 * les alertes, refusé en production et aux rôles non gestionnaires.
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0002",
    name: "Gestion E2E",
    role: session.role,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../../support/test-database");
isolateEachTest();

const { simulateMessage, simulateOrder } =
  await import("@/app/(dashboard)/demo/actions");

const total = async (table: typeof orders | typeof customerMessages) =>
  (await testDb().select({ n: count() }).from(table))[0]!.n;

beforeEach(() => {
  session.role = "gestionnaire";
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("simulateOrder / simulateMessage", () => {
  it("crée une commande en préparation et un message non traité", async () => {
    const ordersBefore = await total(orders);
    const result = await simulateOrder();
    expect(result).toMatchObject({ status: "success" });
    expect(result.status === "success" && result.message).toMatch(
      /^Commande FIG-\d{6}-\d{3} simulée\.$/,
    );
    expect(await total(orders)).toBe(ordersBefore + 1);
    const reference = /FIG-\d{6}-\d{3}/.exec(
      result.status === "success" ? result.message : "",
    )![0];
    const [created] = await testDb()
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.reference, reference));
    expect(created?.status).toBe("preparing");

    const messagesBefore = await total(customerMessages);
    expect(await simulateMessage()).toMatchObject({ status: "success" });
    expect(await total(customerMessages)).toBe(messagesBefore + 1);
  });

  it("refusé au rôle lecture ou livreur, et en production", async () => {
    const before = await total(orders);
    session.role = "lecture";
    expect(await simulateOrder()).toMatchObject({ status: "error" });
    session.role = "livreur";
    expect(await simulateMessage()).toMatchObject({ status: "error" });
    session.role = "admin";
    vi.stubEnv("NODE_ENV", "production");
    expect(await simulateOrder()).toMatchObject({ status: "error" });
    expect(await total(orders)).toBe(before);
  });
});
