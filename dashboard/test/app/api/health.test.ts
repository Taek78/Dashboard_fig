import { describe, expect, it, vi } from "vitest";

/*
 * Route de santé : client Drizzle simulé (aucune base pour ce test). On vérifie
 * le contrat HTTP : 200 { ok: true } / 503 { ok: false }, corps sans détail,
 * Cache-Control: no-store.
 */
vi.mock("server-only", () => ({}));
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/db/client", () => ({ getDb: () => ({ execute }) }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("répond 200 { ok: true } quand la base répond", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("répond 503 { ok: false } sans détail quand la base est injoignable", async () => {
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
});
