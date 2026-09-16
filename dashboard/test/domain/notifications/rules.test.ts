import { describe, expect, it } from "vitest";
import { scenarioCustomers } from "@/domain/customers/fixtures";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { orderStatusNotification } from "@/domain/notifications/rules";
import { NOTIFICATION_KINDS } from "@/domain/notifications/types";
import { orderEventsFixtures, scenarioOrders } from "@/domain/orders/fixtures";

describe("orderStatusNotification", () => {
  const order = { reference: "FIG-260907-001" };

  it("un titre avec la référence, un corps français par statut, jamais le nom de la personne", () => {
    expect(orderStatusNotification(order, "delivering")).toEqual({
      title: "Commande FIG-260907-001",
      body: "Votre commande FIG-260907-001 est en route : votre livreur arrive sur le créneau choisi.",
    });
    expect(orderStatusNotification(order, "delivered").body).toBe(
      "Votre commande FIG-260907-001 a été livrée. Bonne dégustation !",
    );
    expect(orderStatusNotification(order, "preparing").body).toContain(
      "de nouveau en préparation",
    );
  });

  it("une annulation reprend le motif communiqué au client", () => {
    expect(
      orderStatusNotification(order, "cancelled", {
        reason: "other",
        detail: "Client absent",
      }).body,
    ).toBe(
      "Votre commande FIG-260907-001 a été annulée. Motif : Autre : Client absent.",
    );
    expect(orderStatusNotification(order, "cancelled").body).toBe(
      "Votre commande FIG-260907-001 a été annulée.",
    );
  });

  it("une seule nature de notification pour l'instant", () => {
    expect(NOTIFICATION_KINDS).toEqual(["order_status"]);
  });
});

describe("notificationsFixtures", () => {
  it("une par changement de statut des commandes du scénario dont le client a autorisé les notifications d'état", () => {
    const consenting = new Set(
      scenarioCustomers.filter((c) => c.consents.orderStatus).map((c) => c.id),
    );
    const scenarioIds = new Set(scenarioOrders.map((o) => o.id));
    const expected = orderEventsFixtures.filter((e) => {
      const order = scenarioOrders.find((o) => o.id === e.orderId);
      return (
        scenarioIds.has(e.orderId) && order && consenting.has(order.customer.id)
      );
    });
    expect(notificationsFixtures).toHaveLength(expected.length);
    expect(notificationsFixtures.length).toBeGreaterThan(3);
    expect(new Set(notificationsFixtures.map((n) => n.id)).size).toBe(
      notificationsFixtures.length,
    );
    for (const n of notificationsFixtures) {
      const order = scenarioOrders.find((o) => o.id === n.order.id)!;
      expect(consenting.has(n.customerId)).toBe(true);
      expect(n.customerId).toBe(order.customer.id);
      expect(n.body).toContain(order.reference);
      expect(n.body).not.toContain(order.customer.fullName);
      if (n.sentAt !== null) expect(n.sentAt > n.createdAt).toBe(true);
    }
    expect(notificationsFixtures.some((n) => n.sentAt === null)).toBe(true);
    expect(notificationsFixtures.some((n) => n.sentAt !== null)).toBe(true);
  });
});
