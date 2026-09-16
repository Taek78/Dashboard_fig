import { describe, expect, it } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import { customerTier, loyalTierEvents } from "@/domain/customers/tier";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { sortOrdersBySlot } from "@/domain/orders/rules";
import {
  CUSTOMER_EXPORT_FORMAT,
  buildCustomerExport,
  customerExportFileName,
} from "@/domain/privacy/export";
import type { CustomerExportData } from "@/domain/privacy/source";

const AT = new Date("2026-09-15T10:00:00.000Z");
const amel = customersFixtures.find((c) => c.id === "cli-0001")!;

/** Tout ce que la source rendrait pour un client, à partir des fixtures. */
function dataFor(customer: typeof amel): CustomerExportData {
  return {
    customer,
    orders: [...ordersFixtures],
    events: [...orderEventsFixtures],
    messages: [...messagesFixtures],
    notifications: [...notificationsFixtures],
    referralCount: customersFixtures.filter(
      (c) => c.referredBy?.id === customer.id,
    ).length,
  };
}

describe("buildCustomerExport", () => {
  const data = buildCustomerExport(dataFor(amel), AT);
  const own = sortOrdersBySlot(
    ordersFixtures.filter((o) => o.customer.id === amel.id),
  );
  const ownMessages = messagesFixtures
    .filter((m) => m.customer.id === amel.id)
    .toSorted((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  it("contient la fiche, les notes et TOUTES les commandes du client, par créneau", () => {
    expect(data.format).toBe(CUSTOMER_EXPORT_FORMAT);
    expect(data.exportedAt).toBe(AT.toISOString());
    expect(data.customer).toMatchObject({
      id: amel.id,
      fullName: amel.fullName,
      email: amel.email,
      phone: amel.phone,
      addressLine: amel.addressLine,
      consents: amel.consents,
      referralCode: amel.referralCode,
      referred: false,
      referralCount: 2,
      anonymizedAt: null,
    });
    expect(data.internalNotes.map((n) => n.text)).toEqual(
      amel.notes.map((n) => n.text),
    );
    expect(own.length).toBeGreaterThan(2);
    expect(data.orders.map((o) => o.reference)).toEqual(
      own.map((o) => o.reference),
    );
    expect(data.orders[0]?.lines.length).toBe(own[0]?.lines.length);
    expect(data.orders[0]).toMatchObject({
      deliveryAddressLine: own[0]?.deliveryAddressLine,
      deliveryFeeCents: own[0]?.deliveryFeeCents,
    });
  });

  it("dit si la personne a été parrainée, sans nommer le parrain", () => {
    const theo = customersFixtures.find((c) => c.id === "cli-0002")!;
    const exported = buildCustomerExport(dataFor(theo), AT);
    expect(theo.referredBy?.fullName).toBe("Amel Benali");
    expect(exported.customer.referred).toBe(true);
    expect(JSON.stringify(exported)).not.toContain("Amel Benali");
  });

  it("rattache à chaque commande son historique de statuts, par date", () => {
    const ownIds = new Set(own.map((o) => o.id));
    const expected = orderEventsFixtures.filter((e) => ownIds.has(e.orderId));
    expect(data.orders.flatMap((o) => o.statusHistory)).toHaveLength(
      expected.length,
    );
    for (const order of data.orders) {
      const dates = order.statusHistory.map((h) => h.at);
      expect(dates).toEqual(dates.toSorted());
    }
  });

  it("donne la catégorie à l'instant de l'export et l'historique daté des atteintes", () => {
    const tier = customerTier(own, AT.toISOString());
    expect(data.tier.current).toBe(tier.tier);
    expect(["Basique", "Fidèle"]).toContain(data.tier.currentLabel);
    expect(data.tier.history).toEqual(
      loyalTierEvents(own).map((e) => ({
        reachedAt: e.reachedAt,
        expiresAt: e.expiresAt,
        orderReference: e.orderReference,
      })),
    );
    expect(data.tier.history.length).toBeGreaterThan(0);
  });

  it("contient ses messages « Nous contacter », du plus ancien au plus récent", () => {
    expect(ownMessages.length).toBeGreaterThan(1);
    expect(data.messages.map((m) => m.body)).toEqual(
      ownMessages.map((m) => m.body),
    );
    const withFiles = data.messages.find((m) => m.attachments.length > 0)!;
    expect(withFiles.attachments[0]).toMatchObject({
      fileName: "fraises-abimees.jpg",
      contentType: "image/jpeg",
    });
    // L'objet est lisible sans connaître le code interne.
    expect(data.messages.map((m) => m.subjectLabel)).toContain(
      "Produit manquant ou abîmé",
    );
    expect(data.messages.every((m) => typeof m.handled === "boolean")).toBe(
      true,
    );
  });

  it("contient les notifications déposées pour la personne, de la plus ancienne à la plus récente", () => {
    // Amel n'a que des commandes en préparation : rien n'a encore été déposé.
    expect(data.notifications).toEqual([]);
    // Lucie (cli-0005) : deux commandes livrées la veille, quatre notifications.
    const lucie = customersFixtures.find((c) => c.id === "cli-0005")!;
    const exported = buildCustomerExport(dataFor(lucie), AT);
    const ownNotifications = notificationsFixtures.filter(
      (n) => n.customerId === lucie.id,
    );
    expect(ownNotifications.length).toBeGreaterThan(0);
    expect(exported.notifications.map((n) => n.body)).toEqual(
      ownNotifications
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((n) => n.body),
    );
    const dates = exported.notifications.map((n) => n.createdAt);
    expect(dates).toEqual(dates.toSorted());
    expect(exported.notifications[0]).toMatchObject({
      orderReference: "FIG-260906-001",
      orderStatus: "delivering",
    });
  });

  it("ne contient aucune donnée de l'équipe (préparateur, livreur, auteurs)", () => {
    const json = JSON.stringify(data);
    for (const key of ['"preparer"', '"driver"', '"actor"', '"authorName"']) {
      expect(json).not.toContain(key);
    }
    for (const note of amel.notes) {
      expect(json).not.toContain(note.authorName);
    }
  });

  it("ne contient ni le traitant d'un message, ni les marques internes de tri, ni les noms des filleuls", () => {
    const json = JSON.stringify(data);
    for (const key of ['"handledByName"', '"pinnedAt"', '"important"']) {
      expect(json).not.toContain(key);
    }
    for (const referral of customersFixtures.filter(
      (c) => c.referredBy?.id === amel.id,
    )) {
      expect(json).not.toContain(referral.fullName);
    }
  });

  it("ignore les commandes, événements, messages et notifications d'autres clients passés par erreur", () => {
    const other = ordersFixtures.find((o) => o.customer.id !== amel.id)!;
    const otherMessage = messagesFixtures.find(
      (m) => m.customer.id !== amel.id,
    )!;
    const otherNotification = notificationsFixtures.find(
      (n) => n.customerId !== amel.id,
    )!;
    const alone = buildCustomerExport(
      {
        customer: amel,
        orders: [other],
        events: [],
        messages: [otherMessage],
        notifications: [otherNotification],
        referralCount: 0,
      },
      AT,
    );
    expect(alone.orders).toEqual([]);
    expect(alone.messages).toEqual([]);
    expect(alone.notifications).toEqual([]);
    expect(alone.tier.history).toEqual([]);
  });
});

describe("customerExportFileName", () => {
  it("date le fichier et neutralise tout caractère dangereux pour l'en-tête", () => {
    expect(customerExportFileName("cli-0001", AT)).toBe(
      "fig-client-cli-0001-2026-09-15.json",
    );
    expect(customerExportFileName('a"b/c\r\nd', AT)).toBe(
      "fig-client-a_b_c__d-2026-09-15.json",
    );
  });
});
