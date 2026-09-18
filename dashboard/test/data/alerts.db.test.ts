import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { customerMessages, customers, products } from "@/db/schema";
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

    const feed = await alertsDb.getAlertFeed(since, all, now);
    expect(feed.now).toBe(now.toISOString());
    expect(feed.orders.find((o) => o.id === id)).toMatchObject({
      customerName: fullName,
      totalCents: 940,
    });
    expect(feed.orders.find((o) => o.id === id)?.reference).toMatch(
      /^FIG-260919-\d{3}$/,
    );
    expect(feed.messages.map((m) => m.id)).toContain("msg-alerte");
    for (const o of feed.orders) {
      expect(Date.parse(o.createdAt)).toBeGreaterThan(since.getTime());
    }

    // Plus rien après leur arrivée.
    const later = await alertsDb.getAlertFeed(
      new Date(Date.now() + 60_000),
      all,
      now,
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
    const feed = await alertsDb.getAlertFeed(new Date(), all, new Date());
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
    );
    expect(feed).toMatchObject({ orders: [], messages: [], stock: [] });
  });
});
