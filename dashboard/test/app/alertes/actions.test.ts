import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

/*
 * Actions des alertes sur la base de test : la visite d'une section (compteur
 * à zéro, pour le compte de la session seulement) et les préférences de
 * « Mon profil ».
 */
const session = vi.hoisted(() => ({ id: "usr-0002", role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: session.id,
    name: "Gestion E2E",
    role: session.role,
  }),
}));
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest, testDb } = await import("../../support/test-database");
isolateEachTest();

const { markSectionSeen, saveAlertPrefs } =
  await import("@/app/(dashboard)/alertes/actions");
const { getAlertPrefs } = await import("@/data/alerts");
const { idleActionResult } = await import("@/lib/action-result");

const seen = async (id: string) =>
  (
    await testDb()
      .select({
        orders: users.ordersSeenAt,
        messages: users.messagesSeenAt,
      })
      .from(users)
      .where(eq(users.id, id))
  )[0]!;

beforeEach(() => {
  session.id = "usr-0002";
  session.role = "gestionnaire";
});

describe("markSectionSeen", () => {
  it("avance la dernière visite du fil, pour le compte de la session seulement", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    await testDb()
      .update(users)
      .set({ ordersSeenAt: past, messagesSeenAt: past });
    await markSectionSeen("orders");
    expect((await seen("usr-0002")).orders.getTime()).toBeGreaterThan(
      past.getTime(),
    );
    expect((await seen("usr-0002")).messages).toEqual(past);
    expect((await seen("usr-0001")).orders).toEqual(past);
  });

  it("ignore un fil inconnu ou que le rôle ne voit pas", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    await testDb().update(users).set({ messagesSeenAt: past });
    session.id = "usr-0003";
    session.role = "livreur";
    await markSectionSeen("messages");
    await markSectionSeen("comptes");
    expect((await seen("usr-0003")).messages).toEqual(past);
  });
});

describe("saveAlertPrefs", () => {
  it("enregistre les deux cases (absente = désactivée)", async () => {
    const data = new FormData();
    data.set("messages", "on");
    expect(await saveAlertPrefs(idleActionResult, data)).toEqual({
      status: "success",
      message: "Préférences enregistrées.",
    });
    expect(await getAlertPrefs("usr-0002")).toEqual({
      orders: false,
      messages: true,
      muted: false,
    });
    const muted = new FormData();
    muted.set("orders", "on");
    muted.set("muted", "on");
    await saveAlertPrefs(idleActionResult, muted);
    expect(await getAlertPrefs("usr-0002")).toEqual({
      orders: true,
      messages: false,
      muted: true,
    });
    const bad = new FormData();
    bad.set("orders", "oui");
    expect((await saveAlertPrefs(idleActionResult, bad)).status).toBe("error");
  });
});
