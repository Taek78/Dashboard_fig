import { count, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { customerNotifications, orderEvents } from "@/db/schema";
import { communityDiscountPercent } from "@/domain/communities/discount";
import { customersFixtures } from "@/domain/customers/fixtures";
import { loyaltyFromCount, loyaltyCount } from "@/domain/customers/loyalty";
import { ordersFixtures } from "@/domain/orders/fixtures";
import { buildQuote } from "@/domain/orders/quote";
import { productsFixtures } from "@/domain/products/fixtures";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
  tomorrowInParis,
} from "../../../support/api";

/*
 * Routes des commandes de l'API sur la base de test : « mes commandes » par
 * curseur (parité avec les fixtures), devis (parité avec la règle pure),
 * création idempotente (total vérifié, créneau, adresse, référence du jour),
 * détail et annulation conditionnelle. Chaque test dans une transaction
 * annulée ; sessions ouvertes directement en base.
 */
const hoisted = vi.hoisted(() => ({ logged: [] as Record<string, unknown>[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
  }),
}));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest, testDb } =
  await import("../../../support/test-database");
isolateEachTest();

const list = await import("@/app/api/v1/commandes/route");
const devis = await import("@/app/api/v1/commandes/devis/route");
const detail = await import("@/app/api/v1/commandes/[id]/route");
const cancel = await import("@/app/api/v1/commandes/[id]/annulation/route");
const { getOrder } = await import("@/data/orders");

const AMEL = "cli-0001";
const amelOrders = ordersFixtures.filter((o) => o.customer.id === AMEL);
const member = customersFixtures.find((c) => c.community?.id === "com-0001")!;
const carrots = productsFixtures.find((p) => p.id === "prd-0001")!;
const salad = productsFixtures.find((p) => p.id === "prd-0006")!;
const key = () => `cle-${crypto.randomUUID()}`;

type OrderBody = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  deliveryAddressLine: string | null;
  deliveryCity: string;
  discount: { kind: string; percent: number } | null;
  deliveryFeeCents: number;
  totalCents: number;
  community: { id: string } | null;
  paymentReference: string | null;
  cancellable: boolean;
  cancellation: { reason: string; label: string; detail: string | null } | null;
};
type Page = { items: OrderBody[]; nextCursor: string | null };

async function quoteFor(
  token: string,
  lines: { productId: string; quantity: number }[],
) {
  const res = await devis.POST(
    apiRequest("POST", "/api/v1/commandes/devis", { token, body: { lines } }),
    params({}),
  );
  expect(res.status).toBe(200);
  return readJson<{
    totalCents: number;
    discount: unknown;
    deliveryFeeCents: number;
  }>(res);
}

describe("GET /api/v1/commandes", () => {
  it("parcourt toutes mes commandes par curseur, les plus récentes d'abord, sans doublon ni celle d'un autre", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const expected = amelOrders
      .toSorted(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      )
      .map((o) => o.id);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page++) {
      const res = await list.GET(
        apiRequest(
          "GET",
          `/api/v1/commandes?limit=25${cursor ? `&cursor=${cursor}` : ""}`,
          { token },
        ),
        params({}),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await readJson<Page>(res);
      seen.push(...body.items.map((o) => o.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(expected);
    expect(seen.length).toBe(amelOrders.length);
    const first = await readJson<Page>(
      await list.GET(
        apiRequest("GET", "/api/v1/commandes", { token }),
        params({}),
      ),
    );
    expect(first.items).toHaveLength(20);
    expect("preparer" in first.items[0]!).toBe(false);
  });
});

describe("POST /api/v1/commandes/devis", () => {
  it("calcule le même devis que la règle pure sur les fixtures, fidélité et communauté comprises", async () => {
    const lines = [{ productId: carrots.id, quantity: 2000 }];
    for (const customer of [
      customersFixtures.find((c) => c.id === AMEL)!,
      member,
    ]) {
      const token = await sessionTokenFor(customer.id, TEST_AUTH_SECRET);
      const own = ordersFixtures.filter((o) => o.customer.id === customer.id);
      const members = customersFixtures.filter(
        (c) => c.community?.id === customer.community?.id,
      ).length;
      const expected = buildQuote(lines, {
        products: productsFixtures,
        settings: { sellWhenOutOfStock: false },
        loyaltyReady: loyaltyFromCount(loyaltyCount(own)).rewardReady,
        community: customer.community,
        communityPercent: customer.community
          ? communityDiscountPercent(members)
          : 0,
      });
      expect(expected.ok).toBe(true);
      if (!expected.ok) return;
      const quote = await quoteFor(token, lines);
      expect(quote.totalCents).toBe(expected.quote.totalCents);
      expect(quote.deliveryFeeCents).toBe(expected.quote.deliveryFeeCents);
      expect(quote.discount).toEqual(
        expected.quote.discount
          ? expect.objectContaining(expected.quote.discount)
          : null,
      );
    }
  });

  it("refuse un panier invalide avec tous ses problèmes", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const res = await devis.POST(
      apiRequest("POST", "/api/v1/commandes/devis", {
        token,
        body: {
          lines: [
            { productId: "prd-9999", quantity: 1 },
            { productId: salad.id, quantity: 501 },
          ],
        },
      }),
      params({}),
    );
    expect(res.status).toBe(422);
    const body = await readJson<{
      error: { code: string; details: { problems: { code: string }[] } };
    }>(res);
    expect(body.error.code).toBe("quote_invalid");
    expect(body.error.details.problems.map((p) => p.code)).toEqual([
      "unknown_product",
      "quantity_too_large",
    ]);
  });
});

describe("POST /api/v1/commandes", () => {
  it("exige la clé d'idempotence, vérifie le total, crée la commande, la rejoue à l'identique", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const lines = [{ productId: carrots.id, quantity: 1500 }];
    const quote = await quoteFor(token, lines);
    const date = await tomorrowInParis();
    const order = {
      lines,
      deliverySlot: { date, start: "11:00" },
      expectedTotalCents: quote.totalCents,
      paymentReference: "pay_test_001",
    };

    const noKey = await list.POST(
      apiRequest("POST", "/api/v1/commandes", { token, body: order }),
      params({}),
    );
    expect(noKey.status).toBe(400);
    expect((await readJson(noKey)).error).toMatchObject({
      code: "idempotency_key_required",
    });

    const mismatch = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: { ...order, expectedTotalCents: quote.totalCents + 1 },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(mismatch.status).toBe(409);
    const conflict = await readJson<{
      error: { code: string; details: { quote: { totalCents: number } } };
    }>(mismatch);
    expect(conflict.error.code).toBe("total_mismatch");
    expect(conflict.error.details.quote.totalCents).toBe(quote.totalCents);

    const k = key();
    const created = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: order,
        headers: { "idempotency-key": k },
      }),
      params({}),
    );
    expect(created.status).toBe(201);
    const body = await readJson<OrderBody>(created);
    expect(body).toMatchObject({
      status: "preparing",
      totalCents: quote.totalCents,
      deliveryFeeCents: quote.deliveryFeeCents,
      deliveryAddressLine: "12 rue des Lilas",
      deliveryCity: "Paris",
      community: null,
      paymentReference: "pay_test_001",
      cancellable: true,
    });
    expect(body.reference).toBe(`FIG-${date.replace(/-/g, "").slice(2)}-001`);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_order_created",
      orderId: body.id,
    });

    // Le dashboard la voit avec ses lignes et la référence de paiement.
    const stored = await getOrder(body.id);
    expect(stored?.lines).toEqual([
      {
        productId: carrots.id,
        productName: carrots.name,
        quantity: 1500,
        unit: "g",
        lineTotalCents: 435,
      },
    ]);
    expect(stored?.paymentReference).toBe("pay_test_001");
    expect(stored?.reference).toBe(body.reference);

    // Même clé, même corps : la réponse mémorisée, rien de créé en plus.
    const replay = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: order,
        headers: { "idempotency-key": k },
      }),
      params({}),
    );
    expect(replay.status).toBe(201);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await readJson<OrderBody>(replay)).toEqual(body);
    const page = await readJson<Page>(
      await list.GET(
        apiRequest("GET", "/api/v1/commandes?limit=3", { token }),
        params({}),
      ),
    );
    expect(page.items.filter((o) => o.id === body.id)).toHaveLength(1);

    // Même clé, autre corps : refusée.
    const reused = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: { ...order, paymentReference: "pay_autre" },
        headers: { "idempotency-key": k },
      }),
      params({}),
    );
    expect(reused.status).toBe(422);
    expect((await readJson(reused)).error).toMatchObject({
      code: "idempotency_key_reused",
    });

    // Une seconde commande le même jour prend le rang suivant. Le devis est
    // refait : la première commande a pu changer la fidélité, donc le total.
    const requote = await quoteFor(token, lines);
    const second = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: { ...order, expectedTotalCents: requote.totalCents },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(second.status, await second.clone().text()).toBe(201);
    expect((await readJson<OrderBody>(second)).reference).toBe(
      `FIG-${date.replace(/-/g, "").slice(2)}-002`,
    );
  });

  it("refuse un créneau non réservable, et exige une adresse pour un particulier", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const lines = [{ productId: carrots.id, quantity: 1000 }];
    const quote = await quoteFor(token, lines);
    const past = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: {
          lines,
          deliverySlot: { date: "2026-09-01", start: "10:00" },
          expectedTotalCents: quote.totalCents,
        },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(past.status).toBe(422);
    expect((await readJson(past)).error).toMatchObject({
      code: "slot_unavailable",
    });

    const { updateCustomerProfile } = await import("@/data/customers");
    await updateCustomerProfile(AMEL, { addressLine: null }, new Date());
    const noAddress = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: {
          lines,
          deliverySlot: { date: await tomorrowInParis(), start: "10:00" },
          expectedTotalCents: quote.totalCents,
        },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(noAddress.status).toBe(422);
    expect((await readJson(noAddress)).error).toMatchObject({
      code: "address_required",
    });
  });

  it("livre un membre de communauté au point de retrait, sans frais, avec la remise de la communauté", async () => {
    const token = await sessionTokenFor(member.id, TEST_AUTH_SECRET);
    const lines = [{ productId: carrots.id, quantity: 3000 }];
    const quote = await quoteFor(token, lines);
    const created = await list.POST(
      apiRequest("POST", "/api/v1/commandes", {
        token,
        body: {
          lines,
          deliverySlot: { date: await tomorrowInParis(), start: "18:00" },
          expectedTotalCents: quote.totalCents,
        },
        headers: { "idempotency-key": key() },
      }),
      params({}),
    );
    expect(created.status).toBe(201);
    const body = await readJson<OrderBody>(created);
    expect(body).toMatchObject({
      deliveryAddressLine: "Hall d'accueil de la crèche",
      deliveryCity: "Paris",
      deliveryFeeCents: 0,
      community: { id: "com-0001" },
    });
    expect(body.discount).not.toBeNull();
    expect(["community", "loyalty"]).toContain(body.discount!.kind);
  });
});

describe("GET /api/v1/commandes/{id} et POST …/annulation", () => {
  it("ne montre que mes commandes ; annule en préparation, refuse ensuite, rejoue sans effet", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const mine = amelOrders.find((o) => o.status === "preparing")!;
    const other = ordersFixtures.find((o) => o.customer.id !== AMEL)!;

    const own = await detail.GET(
      apiRequest("GET", `/api/v1/commandes/${mine.id}`, { token }),
      params({ id: mine.id }),
    );
    expect(own.status).toBe(200);
    expect((await readJson<OrderBody>(own)).reference).toBe(mine.reference);
    const foreign = await detail.GET(
      apiRequest("GET", `/api/v1/commandes/${other.id}`, { token }),
      params({ id: other.id }),
    );
    expect(foreign.status).toBe(404);
    const foreignCancel = await cancel.POST(
      apiRequest("POST", `/api/v1/commandes/${other.id}/annulation`, { token }),
      params({ id: other.id }),
    );
    expect(foreignCancel.status).toBe(404);

    const before = await testDb()
      .select({ n: count() })
      .from(customerNotifications)
      .where(eq(customerNotifications.orderId, mine.id));
    const cancelled = await cancel.POST(
      apiRequest("POST", `/api/v1/commandes/${mine.id}/annulation`, {
        token,
        body: { detail: "Je serai absent" },
      }),
      params({ id: mine.id }),
    );
    expect(cancelled.status).toBe(200);
    const body = await readJson<OrderBody>(cancelled);
    expect(body).toMatchObject({
      status: "cancelled",
      cancellable: false,
      cancellation: {
        reason: "customer",
        label: "Annulée par le client",
        detail: "Je serai absent",
      },
    });
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_order_cancelled",
      orderId: mine.id,
    });
    const events = await testDb()
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, mine.id));
    expect(events.at(-1)).toMatchObject({
      toStatus: "cancelled",
      actorId: AMEL,
      cancellationReason: "customer",
    });
    // Aucune notification déposée : c'est la personne qui agit.
    const after = await testDb()
      .select({ n: count() })
      .from(customerNotifications)
      .where(eq(customerNotifications.orderId, mine.id));
    expect(after[0]!.n).toBe(before[0]!.n);

    const replay = await cancel.POST(
      apiRequest("POST", `/api/v1/commandes/${mine.id}/annulation`, { token }),
      params({ id: mine.id }),
    );
    expect(replay.status).toBe(200);

    const delivered = amelOrders.find((o) => o.status === "delivered")!;
    const refused = await cancel.POST(
      apiRequest("POST", `/api/v1/commandes/${delivered.id}/annulation`, {
        token,
      }),
      params({ id: delivered.id }),
    );
    expect(refused.status).toBe(409);
    expect((await readJson(refused)).error).toMatchObject({
      code: "not_cancellable",
    });
  });
});
