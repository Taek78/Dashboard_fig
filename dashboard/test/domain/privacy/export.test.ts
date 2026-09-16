import { describe, expect, it } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { sortOrdersBySlot } from "@/domain/orders/rules";
import {
  CUSTOMER_EXPORT_FORMAT,
  buildCustomerExport,
  customerExportFileName,
} from "@/domain/privacy/export";

const AT = new Date("2026-09-15T10:00:00.000Z");
const amel = customersFixtures.find((c) => c.id === "cli-0001")!;

describe("buildCustomerExport", () => {
  const data = buildCustomerExport(
    amel,
    ordersFixtures,
    orderEventsFixtures,
    messagesFixtures,
    AT,
  );
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

  it("ne contient aucune donnée de l'équipe (préparateur, livreur, auteurs)", () => {
    const json = JSON.stringify(data);
    for (const key of ['"preparer"', '"driver"', '"actor"', '"authorName"']) {
      expect(json).not.toContain(key);
    }
    for (const note of amel.notes) {
      expect(json).not.toContain(note.authorName);
    }
  });

  it("ne contient ni le traitant d'un message ni les marques internes de tri", () => {
    const json = JSON.stringify(data);
    for (const key of ['"handledByName"', '"pinnedAt"', '"important"']) {
      expect(json).not.toContain(key);
    }
  });

  it("ignore les commandes, événements et messages d'autres clients passés par erreur", () => {
    const other = ordersFixtures.find((o) => o.customer.id !== amel.id)!;
    const otherMessage = messagesFixtures.find(
      (m) => m.customer.id !== amel.id,
    )!;
    const alone = buildCustomerExport(amel, [other], [], [otherMessage], AT);
    expect(alone.orders).toEqual([]);
    expect(alone.messages).toEqual([]);
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
