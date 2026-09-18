import { describe, expect, it, vi } from "vitest";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import {
  apiRequest,
  params,
  readJson,
  sessionTokenFor,
  TEST_AUTH_SECRET,
} from "../../../support/api";

/*
 * Routes de service de l'API (clé du serveur de l'application) sur la base
 * de test : file des notifications à envoyer et accusé d'envoi conditionnel ;
 * 503 sans clé configurée, 401 avec une mauvaise clé ou un jeton de client.
 */
const hoisted = vi.hoisted(() => ({
  serviceKey: "cle-de-service-de-test-0123456789abcdef" as string | undefined,
  logged: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATABASE_URL: "postgresql://fig:fig@localhost:5434/fig_test",
    AUTH_SECRET: "e2e-secret-fig-dashboard-0123456789-abcdef",
    API_SERVICE_KEY: hoisted.serviceKey,
  }),
}));
vi.mock("@/data/security-log", () => ({
  logSecurity: (event: Record<string, unknown>) => {
    hoisted.logged.push(event);
  },
}));

const { isolateEachTest } = await import("../../../support/test-database");
isolateEachTest();

const pending = await import("@/app/api/v1/service/notifications/route");
const sent =
  await import("@/app/api/v1/service/notifications/[id]/envoi/route");
const failed =
  await import("@/app/api/v1/service/notifications/[id]/echec/route");
const { getOrderNotifications } = await import("@/data/notifications");

const KEY = hoisted.serviceKey!;
const expectedPending = notificationsFixtures.filter((n) => n.sentAt === null);

describe("GET /api/v1/service/notifications", () => {
  it("exige la clé de service (401 sinon, 503 sans clé configurée) et sert la file dans l'ordre de dépôt", async () => {
    const none = await pending.GET(
      apiRequest("GET", "/api/v1/service/notifications"),
      params({}),
    );
    expect(none.status).toBe(401);
    const wrong = await pending.GET(
      apiRequest("GET", "/api/v1/service/notifications", {
        token: "mauvaise-cle",
      }),
      params({}),
    );
    expect(wrong.status).toBe(401);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_service_forbidden",
    });
    const customer = await pending.GET(
      apiRequest("GET", "/api/v1/service/notifications", {
        token: await sessionTokenFor("cli-0001", TEST_AUTH_SECRET),
      }),
      params({}),
    );
    expect(customer.status).toBe(401);

    const res = await pending.GET(
      apiRequest("GET", "/api/v1/service/notifications", { token: KEY }),
      params({}),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{
      items: {
        id: string;
        customerId: string;
        orderReference: string;
        sentAt: null;
      }[];
    }>(res);
    expect(body.items.map((n) => n.id)).toEqual(
      expectedPending.map((n) => n.id),
    );
    expect(body.items[0]).toMatchObject({
      customerId: expectedPending[0]!.customerId,
      sentAt: null,
    });

    hoisted.serviceKey = undefined;
    try {
      const off = await pending.GET(
        apiRequest("GET", "/api/v1/service/notifications", { token: KEY }),
        params({}),
      );
      expect(off.status).toBe(503);
      expect((await readJson(off)).error).toMatchObject({
        code: "service_unavailable",
      });
    } finally {
      hoisted.serviceKey = KEY;
    }
  });
});

describe("POST /api/v1/service/notifications/{id}/envoi", () => {
  it("pose sent_at une seule fois (409 ensuite), 404 pour une inconnue", async () => {
    const target = expectedPending[0]!;
    const ok = await sent.POST(
      apiRequest("POST", `/api/v1/service/notifications/${target.id}/envoi`, {
        token: KEY,
      }),
      params({ id: target.id }),
    );
    expect(ok.status).toBe(200);
    expect(await readJson(ok)).toEqual({ ok: true });
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_notification_sent",
      notificationId: target.id,
    });
    const stored = (await getOrderNotifications(target.order.id)).find(
      (n) => n.id === target.id,
    );
    expect(stored?.sentAt).not.toBeNull();

    const again = await sent.POST(
      apiRequest("POST", `/api/v1/service/notifications/${target.id}/envoi`, {
        token: KEY,
      }),
      params({ id: target.id }),
    );
    expect(again.status).toBe(409);
    expect((await readJson(again)).error).toMatchObject({
      code: "already_sent",
    });

    const missing = await sent.POST(
      apiRequest("POST", "/api/v1/service/notifications/ntf-9999/envoi", {
        token: KEY,
      }),
      params({ id: "ntf-9999" }),
    );
    expect(missing.status).toBe(404);

    const emptied = await readJson<{ items: { id: string }[] }>(
      await pending.GET(
        apiRequest("GET", "/api/v1/service/notifications", { token: KEY }),
        params({}),
      ),
    );
    expect(emptied.items.some((n) => n.id === target.id)).toBe(false);
  });
});

describe("POST /api/v1/service/notifications/{id}/echec", () => {
  const call = (id: string, body?: unknown, token: string | null = KEY) =>
    failed.POST(
      apiRequest("POST", `/api/v1/service/notifications/${id}/echec`, {
        token: token ?? undefined,
        body,
      }),
      params({ id }),
    );

  it("pose l'échec avec sa cause une seule fois (409 ensuite), la sort de la file ; un envoi ultérieur l'efface", async () => {
    const target = expectedPending[0]!;
    expect((await call(target.id, undefined, null)).status).toBe(401);
    const ok = await call(target.id, { raison: "Jeton du téléphone expiré" });
    expect(ok.status).toBe(200);
    expect(hoisted.logged.at(-1)).toMatchObject({
      type: "api_notification_failed",
      notificationId: target.id,
    });
    const stored = (await getOrderNotifications(target.order.id)).find(
      (n) => n.id === target.id,
    );
    expect(stored).toMatchObject({
      sentAt: null,
      failureReason: "Jeton du téléphone expiré",
    });
    expect(stored?.failedAt).not.toBeNull();

    const again = await call(target.id);
    expect(again.status).toBe(409);
    expect((await readJson(again)).error).toMatchObject({
      code: "already_failed",
    });
    const queue = await readJson<{ items: { id: string }[] }>(
      await pending.GET(
        apiRequest("GET", "/api/v1/service/notifications", { token: KEY }),
        params({}),
      ),
    );
    expect(queue.items.some((n) => n.id === target.id)).toBe(false);

    // L'application réussit plus tard : l'accusé d'envoi efface l'échec.
    const late = await sent.POST(
      apiRequest("POST", `/api/v1/service/notifications/${target.id}/envoi`, {
        token: KEY,
      }),
      params({ id: target.id }),
    );
    expect(late.status).toBe(200);
    const after = (await getOrderNotifications(target.order.id)).find(
      (n) => n.id === target.id,
    );
    expect(after).toMatchObject({ failedAt: null, failureReason: null });
    expect((await readJson(await call(target.id))).error).toMatchObject({
      code: "already_sent",
    });
  });

  it("sans corps accepté ; cause trop longue refusée (422) ; inconnue 404", async () => {
    // Chaque test dans sa transaction annulée : la même notification repart en attente.
    const target = expectedPending[0]!;
    expect((await call(target.id, { raison: "x".repeat(201) })).status).toBe(
      422,
    );
    expect((await call(target.id)).status).toBe(200);
    expect((await call("ntf-9999")).status).toBe(404);
  });
});
