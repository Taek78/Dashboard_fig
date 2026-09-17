import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Route de santé : client Drizzle simulé (aucune base pour ce test), horloge
 * simulée pour la fenêtre de sonde, jeton pilotable. On vérifie le contrat
 * HTTP : 200 { ok: true } / 503 { ok: false }, corps sans détail,
 * Cache-Control: no-store, une sonde par fenêtre de cinq secondes, et 401 sans
 * toucher à la base quand HEALTH_TOKEN est posé et que le porteur se trompe.
 */
vi.mock("server-only", () => ({}));
const hoisted = vi.hoisted(() => ({
  execute: vi.fn(),
  token: undefined as string | undefined,
}));
vi.mock("@/db/client", () => ({
  getDb: () => ({ execute: hoisted.execute }),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ HEALTH_TOKEN: hoisted.token }),
}));

const { GET } = await import("@/app/api/health/route");

const TOKEN = "jeton-de-sante-0123456789";
const call = (headers?: Record<string, string>) =>
  GET(new Request("http://localhost/api/health", { headers }));

// Horloge commune qui avance d'une minute par test : chacun commence hors de
// la fenêtre de la sonde du précédent (l'état de la route est celui du module).
let clock = Date.now();
beforeEach(() => {
  clock += 60_000;
  vi.useFakeTimers();
  vi.setSystemTime(clock);
  hoisted.execute.mockReset();
  hoisted.token = undefined;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/health", () => {
  it("répond 200 { ok: true } quand la base répond", async () => {
    hoisted.execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("répond 503 { ok: false } sans détail quand la base est injoignable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    hoisted.execute.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:5432 user=fig"),
    );
    const res = await call();
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: false });
    expect(body).not.toContain("5432");
    spy.mockRestore();
  });

  it("ne sonde la base qu'une fois par fenêtre de cinq secondes", async () => {
    hoisted.execute.mockResolvedValue([{ "?column?": 1 }]);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    vi.advanceTimersByTime(4_999);
    expect((await call()).status).toBe(200);
    expect(hoisted.execute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect((await call()).status).toBe(200);
    expect(hoisted.execute).toHaveBeenCalledTimes(2);
  });

  it("avec HEALTH_TOKEN, exige le bon porteur et refuse sans sonder la base", async () => {
    hoisted.token = TOKEN;
    hoisted.execute.mockResolvedValue([{ "?column?": 1 }]);
    for (const headers of [
      undefined,
      { authorization: "Bearer mauvais-jeton-0123456789" },
      { authorization: `Basic ${TOKEN}` },
      { authorization: `Bearer ${TOKEN}x` },
    ]) {
      const res = await call(headers);
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(await res.json()).toEqual({ ok: false });
    }
    expect(hoisted.execute).not.toHaveBeenCalled();

    const res = await call({ authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(hoisted.execute).toHaveBeenCalledTimes(1);
  });
});
