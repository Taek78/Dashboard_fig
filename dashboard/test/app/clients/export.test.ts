import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Route d'export RGPD d'un client, sur la base de test : session simulée (rôle
 * pilotable), server-only neutralisé, chaque test dans une transaction annulée.
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

const { GET } = await import("@/app/(dashboard)/clients/[id]/export/route");
const { getOrders } = await import("@/data/orders");

const call = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/clients/${id}/export`, { headers }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  session.role = "admin";
});

describe("GET /clients/[id]/export", () => {
  it("l'administrateur télécharge un JSON complet, jamais mis en cache", async () => {
    const response = await call("cli-0001");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="fig-client-cli-0001-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const body = await response.json();
    expect(body.format).toBe("fig-donnees-client/1");
    expect(body.customer.id).toBe("cli-0001");
    expect(body.orders).toHaveLength(
      (await getOrders({ customerId: "cli-0001" })).length,
    );
  });

  it("refuse les autres rôles (403)", async () => {
    for (const role of ["gestionnaire", "lecture", "livreur"]) {
      session.role = role;
      const response = await call("cli-0001");
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("Benali");
    }
  });

  it("refuse une navigation venue d'un autre site, même pour l'administrateur", async () => {
    expect(
      (await call("cli-0001", { "sec-fetch-site": "cross-site" })).status,
    ).toBe(403);
    expect(
      (await call("cli-0001", { "sec-fetch-site": "same-site" })).status,
    ).toBe(403);
    expect(
      (await call("cli-0001", { "sec-fetch-site": "same-origin" })).status,
    ).toBe(200);
    expect((await call("cli-0001", { "sec-fetch-site": "none" })).status).toBe(
      200,
    );
  });

  it("404 pour un client inconnu ou un identifiant invalide", async () => {
    expect((await call("cli-9999")).status).toBe(404);
    expect((await call("x".repeat(65))).status).toBe(404);
  });
});
