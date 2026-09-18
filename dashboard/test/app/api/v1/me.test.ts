import { describe, expect, it, vi } from "vitest";
import { customersFixtures } from "@/domain/customers/fixtures";
import { loyaltyCount } from "@/domain/customers/loyalty";
import { customerTier } from "@/domain/customers/tier";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { ordersFixtures } from "@/domain/orders/fixtures";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
} from "../../../support/api";

/*
 * Routes du profil de l'API sur la base de test : fiche (parité de la
 * fidélité et de la catégorie avec les règles pures), modification partielle
 * et autorisations datées, adhésion à une communauté publique, historique
 * des notifications par curseur, compte anonymisé refusé.
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

const me = await import("@/app/api/v1/me/route");
const communaute = await import("@/app/api/v1/me/communaute/route");
const notifications = await import("@/app/api/v1/me/notifications/route");
const { anonymizeCustomerRows } = await import("@/db/privacy");

const AMEL = "cli-0001";
const amel = customersFixtures.find((c) => c.id === AMEL)!;

type Me = {
  id: string;
  email: string;
  city: string;
  community: { id: string; discountPercent: number } | null;
  consents: {
    offers: boolean;
    orderStatus: boolean;
    marketing: boolean;
    updatedAt: string | null;
  };
  referralCount: number;
  loyalty: { count: number; rewardReady: boolean };
  tier: { tier: string };
};

describe("GET /api/v1/me", () => {
  it("renvoie ma fiche avec la fidélité et la catégorie des règles pures, sans notes internes", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const res = await me.GET(
      apiRequest("GET", "/api/v1/me", { token }),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<Me>(res);
    const own = ordersFixtures.filter((o) => o.customer.id === AMEL);
    expect(body).toMatchObject({
      id: AMEL,
      email: amel.email,
      community: null,
      referralCount: 2,
      loyalty: { count: Math.min(8, loyaltyCount(own)) },
      tier: { tier: customerTier(own, new Date().toISOString()).tier },
    });
    expect("notes" in body).toBe(false);
  });
});

describe("PATCH /api/v1/me", () => {
  it("modifie les champs envoyés seulement, date les autorisations, et refuse un corps vide", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const before = Date.now();
    const res = await me.PATCH(
      apiRequest("PATCH", "/api/v1/me", {
        token,
        body: {
          city: "Lyon",
          consents: { offers: false, orderStatus: true, marketing: false },
        },
      }),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<Me>(res);
    expect(body.city).toBe("Lyon");
    expect(body.email).toBe(amel.email);
    expect(body.consents).toMatchObject({
      offers: false,
      orderStatus: true,
      marketing: false,
    });
    expect(Date.parse(body.consents.updatedAt!)).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_profile_updated",
      consents: true,
    });

    const empty = await me.PATCH(
      apiRequest("PATCH", "/api/v1/me", { token, body: {} }),
      params({}),
    );
    expect(empty.status).toBe(422);
    const email = await me.PATCH(
      apiRequest("PATCH", "/api/v1/me", {
        token,
        body: { email: "autre@example.invalid", city: "Paris" },
      }),
      params({}),
    );
    expect((await readJson<Me>(email)).email).toBe(amel.email);
  });
});

describe("PUT et DELETE /api/v1/me/communaute", () => {
  it("rejoint une communauté publique, refuse une privée ou inconnue, puis la quitte", async () => {
    const token = await sessionTokenFor(AMEL, TEST_AUTH_SECRET);
    const joined = await communaute.PUT(
      apiRequest("PUT", "/api/v1/me/communaute", {
        token,
        body: { communityId: "com-0001" },
      }),
      params({}),
    );
    expect(joined.status).toBe(200);
    expect((await readJson<Me>(joined)).community).toMatchObject({
      id: "com-0001",
      discountPercent: 10,
    });
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_community_changed",
      communityId: "com-0001",
    });

    for (const communityId of ["com-0002", "com-9999"]) {
      const refused = await communaute.PUT(
        apiRequest("PUT", "/api/v1/me/communaute", {
          token,
          body: { communityId },
        }),
        params({}),
      );
      expect(refused.status).toBe(422);
      expect((await readJson(refused)).error).toMatchObject({
        code: "community_not_joinable",
      });
    }

    const left = await communaute.DELETE(
      apiRequest("DELETE", "/api/v1/me/communaute", { token }),
      params({}),
    );
    expect(left.status).toBe(200);
    expect((await readJson<Me>(left)).community).toBeNull();
  });
});

describe("GET /api/v1/me/notifications", () => {
  it("liste mes notifications par curseur, les plus récentes d'abord", async () => {
    const customerId = "cli-0005";
    const token = await sessionTokenFor(customerId, TEST_AUTH_SECRET);
    const expected = notificationsFixtures
      .filter((n) => n.customerId === customerId)
      .toSorted(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
    expect(expected.length).toBeGreaterThan(1);
    const first = await notifications.GET(
      apiRequest("GET", "/api/v1/me/notifications?limit=1", { token }),
      params({}),
    );
    expect(first.status).toBe(200);
    const page1 = await readJson<{
      items: { id: string; orderReference: string }[];
      nextCursor: string | null;
    }>(first);
    expect(page1.items.map((n) => n.id)).toEqual([expected[0]!.id]);
    expect(page1.nextCursor).not.toBeNull();
    const rest = await readJson<{
      items: { id: string }[];
      nextCursor: string | null;
    }>(
      await notifications.GET(
        apiRequest(
          "GET",
          `/api/v1/me/notifications?limit=50&cursor=${page1.nextCursor}`,
          { token },
        ),
        params({}),
      ),
    );
    expect(rest.items.map((n) => n.id)).toEqual(
      expected.slice(1).map((n) => n.id),
    );
    expect(rest.nextCursor).toBeNull();
  });
});

describe("compte anonymisé", () => {
  it("un jeton d'un client anonymisé n'ouvre plus rien (sessions supprimées)", async () => {
    const customerId = "cli-0007";
    const token = await sessionTokenFor(customerId, TEST_AUTH_SECRET);
    const outcome = await anonymizeCustomerRows(
      testDb(),
      customerId,
      new Date(),
    );
    expect(["anonymized", "open_orders"]).toContain(outcome);
    if (outcome !== "anonymized") return;
    const res = await me.GET(
      apiRequest("GET", "/api/v1/me", { token }),
      params({}),
    );
    expect(res.status).toBe(401);
  });
});
