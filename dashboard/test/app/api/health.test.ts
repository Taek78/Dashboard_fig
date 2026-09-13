import { describe, expect, it, vi } from "vitest";

/*
 * Route de santé : env et client Drizzle simulés (aucune base sous Vitest).
 * On vérifie le contrat HTTP : 200 { ok: true } / 503 { ok: false }, corps sans
 * détail, Cache-Control: no-store.
 */
vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({ DATA_SOURCE: "db" as "db" | "mock" }));
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/db/client", () => ({ getDb: () => ({ execute }) }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("répond 200 { ok: true } quand la base répond", async () => {
    env.DATA_SOURCE = "db";
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("répond 503 { ok: false } sans détail quand la base est injoignable", async () => {
    env.DATA_SOURCE = "db";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:5432 user=fig"),
    );
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: false });
    expect(body).not.toContain("5432");
    spy.mockRestore();
  });

  it("en mode mock, répond 200 sans toucher au client Drizzle", async () => {
    env.DATA_SOURCE = "mock";
    execute.mockClear();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(execute).not.toHaveBeenCalled();
  });
});
