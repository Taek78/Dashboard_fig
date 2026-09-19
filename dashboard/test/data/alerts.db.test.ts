import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { customerMessages, customers, products, users } from "@/db/schema";
import { stockLevel } from "@/domain/alerts/rules";
import { customersFixtures } from "@/domain/customers/fixtures";
import type { NewOrder } from "@/domain/orders/types";

/*
 * Flux des alertes en direct sur la base de test, chaque test dans une
 * transaction annulée : les nouveautés après `since`, le stock sous seuil
 * identique à la règle pure (stockLevel), les listes hors du rôle vides.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../support/test-database");
isolateEachTest();

const { alertsDb } = await import("@/data/alerts.db");
const { insertOrder } = await import("@/db/order-insert");

const all = { orders: true, messages: true, stock: true };
const ADMIN = "usr-0001";
const customer = customersFixtures.find((c) => c.community === null)!;

function newOrder(): NewOrder {
  return {
    customerId: customer.id,
    deliverySlot: { date: "2026-09-19", start: "10:00", end: "11:00" },
    deliveryAddressLine: null,
    deliveryCity: "Paris",
    deliveryPostalCode: "75011",
    lines: [
      {
        productId: "prd-0001",
        productName: "Pommes",
        quantity: 1000,
        unit: "g",
        lineTotalCents: 450,
      },
    ],
    deliveryFeeCents: 490,
    totalCents: 940,
    communityId: null,
    discount: null,
    paymentReference: null,
  };
}

describe("alertsDb.getAlertFeed", () => {
  it("renvoie la commande et le message arrivés après `since`, avec le nom du client", async () => {
    const now = new Date();
    const since = new Date(now.getTime() - 1000);
    const id = await testDb().transaction((tx) => insertOrder(tx, newOrder()));
    await testDb().insert(customerMessages).values({
      id: "msg-alerte",
      customerId: customer.id,
      subject: "other",
      body: "Bonjour",
    });
    const [{ fullName } = { fullName: "" }] = await testDb()
      .select({ fullName: customers.fullName })
      .from(customers)
      .where(eq(customers.id, customer.id));

    const feed = await alertsDb.getAlertFeed(since, all, now, ADMIN);
    expect(feed.now).toBe(now.toISOString());
    expect(feed.orders.find((o) => o.id === id)).toMatchObject({
      customerName: fullName,
      totalCents: 940,
      addressLine: null,
      postalCode: "75011",
      city: "Paris",
    });
    expect(feed.messages.map((m) => m.id)).toContain("msg-alerte");
    for (const o of feed.orders) {
      expect(Date.parse(o.createdAt)).toBeGreaterThan(since.getTime());
    }

    // Plus rien après leur arrivée.
    const later = await alertsDb.getAlertFeed(
      new Date(Date.now() + 60_000),
      all,
      now,
      ADMIN,
    );
    expect(later.orders).toEqual([]);
    expect(later.messages).toEqual([]);
  });

  it("le stock sous seuil est exactement celui de la règle pure (critique et 0)", async () => {
    // Un produit à 0 et un autre juste sous son seuil, pour ne pas dépendre du seed.
    const rows = await testDb().select().from(products);
    const [a, b] = rows;
    await testDb()
      .update(products)
      .set({ stockQuantity: 0 })
      .where(eq(products.id, a!.id));
    await testDb()
      .update(products)
      .set({ stockQuantity: b!.unit === "g" ? 1999 : 9 })
      .where(eq(products.id, b!.id));

    const everything = await testDb().select().from(products);
    const expected = everything
      .filter((p) => stockLevel(p) !== "ok")
      .map((p) => p.id)
      .toSorted();
    const feed = await alertsDb.getAlertFeed(
      new Date(),
      all,
      new Date(),
      ADMIN,
    );
    expect(feed.stock.map((p) => p.id).toSorted()).toEqual(expected);
    expect(expected).toContain(a!.id);
    expect(expected).toContain(b!.id);
  });

  it("une liste hors du périmètre du rôle reste vide", async () => {
    await testDb().transaction((tx) => insertOrder(tx, newOrder()));
    const feed = await alertsDb.getAlertFeed(
      new Date(Date.now() - 60_000),
      { orders: false, messages: false, stock: false },
      new Date(),
      ADMIN,
    );
    expect(feed).toMatchObject({
      orders: [],
      messages: [],
      stock: [],
      unread: { orders: 0, messages: 0, stock: 0 },
    });
  });
});

describe("alertsDb : compteurs non lus et préférences", () => {
  it("compte depuis la dernière visite ; la visite remet à zéro, jamais en arrière", async () => {
    const past = new Date(Date.now() - 60_000);
    // Un instant de départ connu pour les trois fils.
    await testDb()
      .update(users)
      .set({ ordersSeenAt: past, messagesSeenAt: past, stockSeenAt: past })
      .where(eq(users.id, ADMIN));
    await testDb().transaction((tx) => insertOrder(tx, newOrder()));
    await testDb().transaction((tx) => insertOrder(tx, newOrder()));
    await testDb().insert(customerMessages).values({
      id: "msg-non-lu",
      customerId: customer.id,
      subject: "other",
      body: "Bonjour",
    });
    const [product] = await testDb().select().from(products).limit(1);
    await testDb()
      .update(products)
      .set({ stockQuantity: 0, updatedAt: new Date() })
      .where(eq(products.id, product!.id));

    const feed = await alertsDb.getAlertFeed(
      new Date(),
      all,
      new Date(),
      ADMIN,
    );
    expect(feed.unread).toEqual({ orders: 2, messages: 1, stock: 1 });

    const now = new Date(Date.now() + 1000);
    await alertsDb.markAlertsSeen(ADMIN, "orders", now);
    await alertsDb.markAlertsSeen(ADMIN, "orders", past); // ignoré : en arrière
    const after = await alertsDb.getAlertFeed(
      new Date(),
      all,
      new Date(),
      ADMIN,
    );
    expect(after.unread).toEqual({ orders: 0, messages: 1, stock: 1 });
    // Hors périmètre : 0.
    const none = await alertsDb.getAlertFeed(
      new Date(),
      { orders: false, messages: false, stock: false },
      new Date(),
      ADMIN,
    );
    expect(none.unread).toEqual({ orders: 0, messages: 0, stock: 0 });
  });

  it("préférences : activées par défaut, enregistrées par compte", async () => {
    expect(await alertsDb.getAlertPrefs(ADMIN)).toEqual({
      orders: true,
      messages: true,
      muted: false,
    });
    await alertsDb.setAlertPrefs(ADMIN, {
      orders: false,
      messages: true,
      muted: true,
    });
    expect(await alertsDb.getAlertPrefs(ADMIN)).toEqual({
      orders: false,
      messages: true,
      muted: true,
    });
    // Les deux notifications coupées : la case du son retombe.
    await alertsDb.setAlertPrefs(ADMIN, {
      orders: false,
      messages: false,
      muted: true,
    });
    expect((await alertsDb.getAlertPrefs(ADMIN)).muted).toBe(false);
    expect(await alertsDb.getAlertPrefs("usr-inconnu")).toEqual({
      orders: true,
      messages: true,
      muted: false,
    });
  });
});
