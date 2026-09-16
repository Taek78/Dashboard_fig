import { describe, expect, it, vi } from "vitest";
import { notificationsFixtures } from "@/domain/notifications/fixtures";

/*
 * File de notifications sur la base de TEST (seedée avec les fixtures), chaque
 * test dans une transaction annulée : les deux lectures, comparées aux
 * fixtures triées comme le contrat le promet.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { notificationsDb } = await import("@/data/notifications.db");

describe("notificationsDb", () => {
  it("getOrderNotifications : celles d'une commande, de la plus récente à la plus ancienne", async () => {
    // cmd-0005 (Lucie, autorisée) : expédiée puis livrée la veille du scénario.
    const found = await notificationsDb.getOrderNotifications("cmd-0005");
    const expected = notificationsFixtures
      .filter((n) => n.order.id === "cmd-0005")
      .toSorted(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    expect(expected).toHaveLength(2);
    expect(found).toEqual(expected);
    expect(found[0]?.orderStatus).toBe("delivered");
    expect(found.every((n) => n.sentAt !== null)).toBe(true);
    // cmd-0013 (Mathis, rien autorisé) : aucune.
    expect(await notificationsDb.getOrderNotifications("cmd-0013")).toEqual([]);
    expect(await notificationsDb.getOrderNotifications("cmd-9999")).toEqual([]);
  });

  it("getCustomerNotifications : toutes celles d'une personne, de la plus ancienne à la plus récente", async () => {
    const found = await notificationsDb.getCustomerNotifications("cli-0005");
    const expected = notificationsFixtures
      .filter((n) => n.customerId === "cli-0005")
      .toSorted(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    expect(expected.length).toBeGreaterThan(2);
    expect(found).toEqual(expected);
    expect(await notificationsDb.getCustomerNotifications("cli-9999")).toEqual(
      [],
    );
  });
});
