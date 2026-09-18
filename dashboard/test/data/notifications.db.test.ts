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

describe("notificationsDb : suivi de l'envoi (échec, remise en file)", () => {
  const target = () => notificationsFixtures.find((n) => n.sentAt === null)!;
  const at = new Date("2026-09-18T10:00:00.000Z");

  it("en attente → échec (sort de la file) → remise en file → envoyée", async () => {
    const id = target().id;
    expect(await notificationsDb.getNotificationDelivery(id)).toMatchObject({
      id,
      orderId: target().order.id,
      state: "pending",
      failureReason: null,
    });
    expect(await notificationsDb.markNotificationFailed(id, at, "Réseau")).toBe(
      "failed",
    );
    expect(await notificationsDb.markNotificationFailed(id, at, null)).toBe(
      "already_failed",
    );
    expect(await notificationsDb.getNotificationDelivery(id)).toMatchObject({
      state: "failed",
      failureReason: "Réseau",
    });
    const queue = await notificationsDb.listPendingNotifications(500);
    expect(queue.some((n) => n.id === id)).toBe(false);

    expect(await notificationsDb.requeueNotification(id)).toBe("queued");
    expect(await notificationsDb.getNotificationDelivery(id)).toMatchObject({
      state: "pending",
      failureReason: null,
    });
    expect(
      (await notificationsDb.listPendingNotifications(500)).some(
        (n) => n.id === id,
      ),
    ).toBe(true);

    expect(await notificationsDb.markNotificationSent(id, at)).toBe("sent");
    expect(await notificationsDb.requeueNotification(id)).toBe("already_sent");
    expect(await notificationsDb.markNotificationFailed(id, at, null)).toBe(
      "already_sent",
    );
    expect((await notificationsDb.getNotificationDelivery(id))?.state).toBe(
      "sent",
    );
  });

  it("inconnue : null et not_found", async () => {
    expect(
      await notificationsDb.getNotificationDelivery("ntf-9999"),
    ).toBeNull();
    expect(await notificationsDb.requeueNotification("ntf-9999")).toBe(
      "not_found",
    );
    expect(
      await notificationsDb.markNotificationFailed("ntf-9999", at, null),
    ).toBe("not_found");
  });
});
