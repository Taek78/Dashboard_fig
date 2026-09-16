import { and, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  customerMessages,
  customerNotes,
  loginAttempts,
  messageAttachments,
  orderEvents,
  orders,
  securityEvents,
} from "@/db/schema";
import { customersFixtures } from "@/domain/customers/fixtures";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { filterOrders, sortOrdersBySlot } from "@/domain/orders/rules";
import { isCustomerInactive } from "@/domain/privacy/retention";

/*
 * Demandes RGPD sur la base de TEST (seedée avec les fixtures), chaque test
 * dans une transaction annulée : export complet, anonymisation (ce qui
 * disparaît, ce qui reste), clients inactifs comparés à la règle pure
 * isCustomerInactive, purge en aperçu puis appliquée.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { privacyDb } = await import("@/data/privacy.db");
const { customersDb } = await import("@/data/customers.db");
const { ordersDb } = await import("@/data/orders.db");
const { findInactiveCustomers, purgeExpiredData } =
  await import("@/db/privacy");

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);
const sorted = (values: readonly string[]) => [...values].sort();

describe("privacyDb.getCustomerExportData", () => {
  it("renvoie la fiche, les notes, toutes les commandes et tout l'historique du client", async () => {
    const data = await privacyDb.getCustomerExportData("cli-0001");
    const fixture = customersFixtures.find((c) => c.id === "cli-0001")!;
    const own = sortOrdersBySlot(
      filterOrders(ordersFixtures, { customerId: "cli-0001" }),
    );
    const ownIds = new Set(ids(own));

    expect(data?.customer).toEqual(fixture);
    expect(ids(data!.orders)).toEqual(ids(own));
    expect(sorted(ids(data!.events))).toEqual(
      sorted(ids(orderEventsFixtures.filter((e) => ownIds.has(e.orderId)))),
    );

    // Ses messages « Nous contacter », du plus ancien au plus récent.
    const ownMessages = messagesFixtures
      .filter((m) => m.customer.id === "cli-0001")
      .toSorted((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    expect(ownMessages.length).toBeGreaterThan(0);
    expect(ids(data!.messages)).toEqual(ids(ownMessages));
    expect(data!.messages[0]).toEqual(ownMessages[0]);
  });

  it("null pour un client inconnu", async () => {
    expect(await privacyDb.getCustomerExportData("cli-9999")).toBeNull();
  });
});

describe("privacyDb.anonymizeCustomer", () => {
  // cli-0011 : une commande annulée avec une précision libre (cmd-0013).
  const id = "cli-0011";

  it("efface identité, coordonnées, notes et précisions ; garde les commandes", async () => {
    const before = (await customersDb.getCustomer(id))!;
    await customersDb.addNote(id, {
      text: "Code d'entrée 1234",
      authorName: "Gestion E2E",
      createdAt: new Date().toISOString(),
    });
    const ordersBefore = await ordersDb.getOrders({ customerId: id });
    const at = new Date("2026-09-15T10:00:00.000Z");

    expect(await privacyDb.anonymizeCustomer(id, at)).toBe("anonymized");

    expect(await customersDb.getCustomer(id)).toEqual({
      ...before,
      fullName: "Client anonymisé",
      email: `anonyme-${id}@anonyme.invalid`,
      phone: "",
      city: "",
      postalCode: "",
      community: null,
      notes: [],
      anonymizedAt: at.toISOString(),
    });
    const notesLeft = await testDb()
      .select()
      .from(customerNotes)
      .where(eq(customerNotes.customerId, id));
    expect(notesLeft).toEqual([]);

    const ordersAfter = await ordersDb.getOrders({ customerId: id });
    expect(ids(ordersAfter)).toEqual(ids(ordersBefore));
    expect(ordersAfter.map((o) => o.totalCents)).toEqual(
      ordersBefore.map((o) => o.totalCents),
    );
    expect(ordersAfter.find((o) => o.id === "cmd-0013")?.cancellation).toEqual({
      reason: "other",
      detail: null,
    });
    const events = await testDb()
      .select({ detail: orderEvents.cancellationDetail })
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, ids(ordersAfter)));
    expect(events.every((e) => e.detail === null)).toBe(true);

    // Plus aucune commande retrouvable par l'ancien nom, e-mail ou téléphone.
    for (const query of [before.fullName, before.email, before.phone]) {
      const found = await ordersDb.getOrders({ query });
      expect(found.some((o) => o.customer.id === id)).toBe(false);
    }
  });

  it("supprime ses messages « Nous contacter » et leurs pièces jointes", async () => {
    await testDb()
      .insert(customerMessages)
      .values({
        id: "msg-anonymise",
        customerId: id,
        subject: "delivery_issue",
        body: "Mon code d'entrée est le 4512, appelez-moi au 06 12 34 56 78.",
        orderId: null,
        status: "untreated",
        receivedAt: new Date("2026-09-09T09:00:00.000Z"),
      });
    await testDb().insert(messageAttachments).values({
      id: "att-anonymise",
      messageId: "msg-anonymise",
      position: 0,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      url: "https://fichiers.fig.invalid/messages/photo.jpg",
    });

    expect(await privacyDb.anonymizeCustomer(id, new Date())).toBe(
      "anonymized",
    );

    expect(
      await testDb()
        .select()
        .from(customerMessages)
        .where(eq(customerMessages.customerId, id)),
    ).toEqual([]);
    // La pièce jointe part avec son message (ON DELETE CASCADE).
    expect(
      await testDb()
        .select()
        .from(messageAttachments)
        .where(eq(messageAttachments.id, "att-anonymise")),
    ).toEqual([]);
  });

  it("retire l'adhésion du client, pas la communauté de ses commandes passées", async () => {
    const member = customersFixtures.find((c) => c.community !== null)!;
    const before = await ordersDb.getOrders({ customerId: member.id });
    await privacyDb.anonymizeCustomer(member.id, new Date());
    expect((await customersDb.getCustomer(member.id))?.community).toBeNull();
    expect(
      (await ordersDb.getOrders({ customerId: member.id })).map(
        (o) => o.community,
      ),
    ).toEqual(before.map((o) => o.community));
  });

  it("refuse tant qu'une commande est ouverte, sans rien écrire ; accepte une fois livrée", async () => {
    // cli-0004 : cmd-0004 expédiée.
    const before = await customersDb.getCustomer("cli-0004");
    expect(await privacyDb.anonymizeCustomer("cli-0004", new Date())).toBe(
      "open_orders",
    );
    expect(await customersDb.getCustomer("cli-0004")).toEqual(before);

    await ordersDb.updateOrderStatus("cmd-0004", {
      from: "delivering",
      to: "delivered",
      actor: { id: "usr-0001", name: "Admin E2E" },
      cancellation: null,
    });
    expect(await privacyDb.anonymizeCustomer("cli-0004", new Date())).toBe(
      "anonymized",
    );
  });

  it("rejouer la demande efface encore un texte libre resté après une course", async () => {
    await privacyDb.anonymizeCustomer(id, new Date());
    await testDb().insert(customerNotes).values({
      id: "note-restee",
      customerId: id,
      text: "Écrite pendant l'anonymisation",
      authorName: "Gestion E2E",
      createdAt: new Date(),
    });
    expect(await privacyDb.anonymizeCustomer(id, new Date())).toBe(
      "already_anonymized",
    );
    expect(
      await testDb()
        .select()
        .from(customerNotes)
        .where(eq(customerNotes.customerId, id)),
    ).toEqual([]);
  });

  it("ne refait rien sur un client déjà anonymisé ou inconnu ; plus de note ensuite", async () => {
    const first = new Date("2026-09-15T10:00:00.000Z");
    await privacyDb.anonymizeCustomer(id, first);
    expect(await privacyDb.anonymizeCustomer(id, new Date())).toBe(
      "already_anonymized",
    );
    expect((await customersDb.getCustomer(id))?.anonymizedAt).toBe(
      first.toISOString(),
    );
    expect(await privacyDb.anonymizeCustomer("cli-9999", new Date())).toBe(
      "not_found",
    );
    expect(
      await customersDb.addNote(id, {
        text: "x",
        authorName: "Gestion E2E",
        createdAt: new Date().toISOString(),
      }),
    ).toBeNull();
  });
});

describe("findInactiveCustomers = isCustomerInactive", () => {
  const lastDelivery = new Map<string, string>();
  const withOpenOrders = new Set<string>();
  for (const order of ordersFixtures) {
    const current = lastDelivery.get(order.customer.id);
    if (!current || order.deliverySlot.date > current) {
      lastDelivery.set(order.customer.id, order.deliverySlot.date);
    }
    if (order.status === "preparing" || order.status === "delivering") {
      withOpenOrders.add(order.customer.id);
    }
  }
  const expected = (since: string) =>
    customersFixtures
      .filter((c) =>
        isCustomerInactive(
          {
            createdAt: c.createdAt,
            lastDeliveryDate: lastDelivery.get(c.id) ?? null,
            hasOpenOrders: withOpenOrders.has(c.id),
          },
          since,
        ),
      )
      .map((c) => c.id);

  it("même liste que la règle pure à plusieurs bornes", async () => {
    for (const since of [
      "2025-01-01",
      "2026-09-10",
      "2026-01-01",
      "2026-09-08",
      "2030-01-01",
    ]) {
      expect(sorted(await findInactiveCustomers(testDb(), since))).toEqual(
        sorted(expected(since)),
      );
    }
    expect(withOpenOrders.size).toBeGreaterThan(0);
    expect(expected("2030-01-01")).toHaveLength(
      customersFixtures.length - withOpenOrders.size,
    );
  });

  it("ignore les clients déjà anonymisés", async () => {
    await privacyDb.anonymizeCustomer("cli-0005", new Date());
    expect(await findInactiveCustomers(testDb(), "2030-01-01")).not.toContain(
      "cli-0005",
    );
  });
});

describe("purgeExpiredData", () => {
  // Un an après la fin des données de démonstration : des clients sont inactifs.
  const now = new Date("2027-09-10T12:00:00.000Z");
  const retention = {
    inactiveCustomerYears: 1,
    securityEventMonths: 12,
    loginAttemptHours: 24,
  };

  async function insertExpiredRows() {
    await testDb()
      .insert(securityEvents)
      .values([
        {
          id: "purge-ancien",
          type: "login_failure",
          details: {},
          at: new Date("2025-01-01T00:00:00.000Z"),
        },
        {
          id: "purge-recent",
          type: "login_failure",
          details: {},
          at: new Date("2026-09-14T00:00:00.000Z"),
        },
        {
          // Preuve d'une demande RGPD : jamais purgée avec le reste du journal.
          id: "purge-preuve",
          type: "customer_anonymized",
          details: { userId: "usr-0001", customerId: "cli-0005" },
          at: new Date("2025-01-01T00:00:00.000Z"),
        },
      ]);
    await testDb()
      .insert(loginAttempts)
      .values([
        {
          key: "email:purge-ancien@test.invalid",
          failures: 2,
          lastFailureAt: new Date("2027-09-05T00:00:00.000Z"),
          lockedUntil: null,
        },
        {
          key: "email:purge-verrou@test.invalid",
          failures: 9,
          lastFailureAt: new Date("2027-09-05T00:00:00.000Z"),
          lockedUntil: new Date("2027-09-11T00:00:00.000Z"),
        },
        {
          key: "email:purge-recent@test.invalid",
          failures: 1,
          lastFailureAt: new Date("2027-09-10T11:00:00.000Z"),
          lockedUntil: null,
        },
      ]);
  }

  it("l'aperçu compte sans rien écrire", async () => {
    const empty = await purgeExpiredData(testDb(), now, {
      apply: false,
      retention,
    });
    await insertExpiredRows();
    const preview = await purgeExpiredData(testDb(), now, {
      apply: false,
      retention,
    });

    expect(preview.securityEvents).toBe(empty.securityEvents + 1);
    expect(preview.loginAttempts).toBe(empty.loginAttempts + 1);
    expect(preview.cutoffs.customerActivitySince).toBe("2026-09-10");
    expect(preview.inactiveCustomers).toEqual(
      await findInactiveCustomers(testDb(), "2026-09-10"),
    );
    expect(preview.inactiveCustomers.length).toBeGreaterThan(0);
    expect(
      await purgeExpiredData(testDb(), now, { apply: false, retention }),
    ).toEqual(preview);
    const first = preview.inactiveCustomers[0]!;
    expect((await customersDb.getCustomer(first))?.anonymizedAt).toBeNull();
  });

  it("--apply supprime et anonymise ce que l'aperçu annonçait, pas plus", async () => {
    await insertExpiredRows();
    const preview = await purgeExpiredData(testDb(), now, {
      apply: false,
      retention,
    });
    const progress: [number, number][] = [];
    const applied = await purgeExpiredData(testDb(), now, {
      apply: true,
      retention,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(applied).toEqual(preview);
    const total = applied.inactiveCustomers.length;
    expect(progress).toHaveLength(total);
    expect(progress.at(-1)).toEqual([total, total]);

    const eventIds = ids(
      await testDb()
        .select({ id: securityEvents.id })
        .from(securityEvents)
        .where(
          inArray(securityEvents.id, [
            "purge-ancien",
            "purge-recent",
            "purge-preuve",
          ]),
        ),
    );
    expect(sorted(eventIds)).toEqual(["purge-preuve", "purge-recent"]);
    const journaled = await testDb()
      .select({ details: securityEvents.details })
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.type, "customer_anonymized"),
          sql`${securityEvents.details}->>'userId' = 'rgpd-purge'`,
        ),
      );
    expect(sorted(journaled.map((e) => String(e.details.customerId)))).toEqual(
      sorted(applied.inactiveCustomers),
    );
    const keys = (await testDb().select().from(loginAttempts)).map(
      (r) => r.key,
    );
    expect(keys).not.toContain("email:purge-ancien@test.invalid");
    expect(keys).toContain("email:purge-verrou@test.invalid");
    expect(keys).toContain("email:purge-recent@test.invalid");

    for (const id of applied.inactiveCustomers.slice(0, 3)) {
      expect((await customersDb.getCustomer(id))?.anonymizedAt).toBe(
        now.toISOString(),
      );
    }
    const inactiveOrders = await testDb()
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.customerId, applied.inactiveCustomers));
    expect(inactiveOrders.length).toBeGreaterThan(0);

    const after = await purgeExpiredData(testDb(), now, {
      apply: false,
      retention,
    });
    expect(after).toMatchObject({
      securityEvents: 0,
      loginAttempts: 0,
      inactiveCustomers: [],
    });
  });
});
