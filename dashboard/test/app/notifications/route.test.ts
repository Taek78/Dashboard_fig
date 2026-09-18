import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsFixtures } from "@/domain/notifications/fixtures";

/*
 * GET /notifications/[id] : l'état d'envoi relu par le badge « Client
 * notifié », sur la base de test. Session simulée, rôle pilotable.
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0002",
    name: "Gestion E2E",
    role: session.role,
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { GET } = await import("@/app/(dashboard)/notifications/[id]/route");
const { markNotificationFailed } = await import("@/data/notifications");

const call = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/notifications/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

const pendingOne = notificationsFixtures.find((n) => n.sentAt === null)!;
const sentOne = notificationsFixtures.find((n) => n.sentAt !== null)!;

beforeEach(() => {
  session.role = "gestionnaire";
});

describe("GET /notifications/[id]", () => {
  it("dit en attente, envoyée ou en échec (avec la cause), sans cache", async () => {
    const pending = await call(pendingOne.id);
    expect(pending.headers.get("cache-control")).toBe("private, no-store");
    expect(await pending.json()).toEqual({
      state: "pending",
      failureReason: null,
    });
    expect(await (await call(sentOne.id)).json()).toMatchObject({
      state: "sent",
    });
    await markNotificationFailed(pendingOne.id, new Date(), "Hors ligne");
    expect(await (await call(pendingOne.id)).json()).toEqual({
      state: "failed",
      failureReason: "Hors ligne",
    });
  });

  it("404 si inconnue ; 403 pour le rôle lecture ou un autre site", async () => {
    expect((await call("ntf-9999")).status).toBe(404);
    expect(
      (await call(pendingOne.id, { "sec-fetch-site": "cross-site" })).status,
    ).toBe(403);
    session.role = "lecture";
    expect((await call(pendingOne.id)).status).toBe(403);
  });
});
