import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * GET /alertes : le flux des alertes en direct, sur la base de test. Session
 * simulée, rôle pilotable : chaque liste suit le périmètre du rôle ; un autre
 * site est refusé ; jamais de cache.
 */
const session = vi.hoisted(() => ({ role: "admin" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0001",
    name: "Admin E2E",
    role: session.role,
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { GET } = await import("@/app/(dashboard)/alertes/route");

const call = (query = "", headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/alertes${query}`, { headers }));

beforeEach(() => {
  session.role = "admin";
});

describe("GET /alertes", () => {
  it("renvoie le flux en JSON, jamais mis en cache", async () => {
    const response = await call("?depuis=2026-09-18T10:00:00.000Z");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const feed = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(feed).toSorted()).toEqual([
      "messages",
      "now",
      "orders",
      "stock",
    ]);
    expect(Array.isArray(feed.stock)).toBe(true);
  });

  it("le livreur ne reçoit ni messages ni stock", async () => {
    session.role = "livreur";
    const feed = (await (await call()).json()) as {
      messages: unknown[];
      stock: unknown[];
    };
    expect(feed.messages).toEqual([]);
    expect(feed.stock).toEqual([]);
  });

  it("refuse une requête venue d'un autre site", async () => {
    const response = await call("", { "sec-fetch-site": "cross-site" });
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
