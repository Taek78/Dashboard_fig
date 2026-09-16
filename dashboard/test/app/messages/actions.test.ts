import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Les trois bascules d'un message, de bout en bout sur la base de test :
 * session simulée (rôle pilotable), server-only neutralisé, revalidatePath
 * espionné. Chaque test dans une transaction annulée.
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
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { changeMessageStatus, toggleMessageImportant, toggleMessagePin } =
  await import("@/app/(dashboard)/messages/actions");
const { getMessage } = await import("@/data/messages");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

const setStatus = (fields: Record<string, string>) =>
  changeMessageStatus(idleActionResult, form(fields));
const setPin = (fields: Record<string, string>) =>
  toggleMessagePin(idleActionResult, form(fields));
const setImportant = (fields: Record<string, string>) =>
  toggleMessageImportant(idleActionResult, form(fields));

beforeEach(() => {
  session.role = "gestionnaire";
  revalidatePath.mockClear();
});

describe("droits", () => {
  it("refuse la lecture seule et le livreur, sans rien écrire", async () => {
    for (const role of ["lecture", "livreur"]) {
      session.role = role;
      const message =
        "Vous n'avez pas les droits pour traiter les messages clients.";
      expect(
        await setStatus({ messageId: "msg-0004", nextStatus: "treated" }),
      ).toEqual({ status: "error", message });
      expect(await setPin({ messageId: "msg-0004", pinned: "oui" })).toEqual({
        status: "error",
        message,
      });
      expect(
        await setImportant({ messageId: "msg-0004", important: "oui" }),
      ).toEqual({ status: "error", message });
    }
    expect(await getMessage("msg-0004")).toMatchObject({
      status: "untreated",
      pinnedAt: null,
      important: false,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("l'administrateur et le gestionnaire peuvent traiter", async () => {
    for (const role of ["admin", "gestionnaire"]) {
      session.role = role;
      expect(
        (await setImportant({ messageId: "msg-0004", important: "oui" }))
          .status,
      ).toBe("success");
      await setImportant({ messageId: "msg-0004", important: "non" });
    }
  });
});

describe("changeMessageStatus", () => {
  it("marque traité, signe avec la session et l'horloge du serveur, revalide", async () => {
    expect(
      await setStatus({ messageId: "msg-0004", nextStatus: "treated" }),
    ).toEqual({ status: "success", message: "Message traité." });

    const message = await getMessage("msg-0004");
    expect(message?.status).toBe("treated");
    expect(message?.handledByName).toBe("Gestion E2E");
    expect(new Date(message!.handledAt!).toISOString()).toBe(
      message!.handledAt,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/messages", "layout");
  });

  it("ignore un traitant envoyé par le formulaire", async () => {
    await setStatus({
      messageId: "msg-0004",
      nextStatus: "treated",
      handledByName: "Pirate",
      handledAt: "1999-01-01T00:00:00.000Z",
    });
    const message = await getMessage("msg-0004");
    expect(message?.handledByName).toBe("Gestion E2E");
    expect(message?.handledAt?.startsWith("1999")).toBe(false);
  });

  it("rejouer la même demande ne fait rien (double clic)", async () => {
    await setStatus({ messageId: "msg-0004", nextStatus: "treated" });
    revalidatePath.mockClear();
    expect(
      await setStatus({ messageId: "msg-0004", nextStatus: "treated" }),
    ).toEqual({ status: "success", message: "Déjà « Traité »." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rouvre un message classé trop vite", async () => {
    await setStatus({ messageId: "msg-0003", nextStatus: "untreated" });
    expect((await getMessage("msg-0003"))?.status).toBe("untreated");
  });

  it("refuse un statut inconnu ou un message absent", async () => {
    expect(
      await setStatus({ messageId: "msg-0004", nextStatus: "archive" }),
    ).toEqual({ status: "error", message: "Demande invalide." });
    expect(
      await setStatus({ messageId: "msg-9999", nextStatus: "treated" }),
    ).toEqual({ status: "error", message: "Ce message n'existe plus." });
  });
});

describe("toggleMessagePin / toggleMessageImportant", () => {
  it("épingle puis désépingle, avec un message parlant", async () => {
    expect(await setPin({ messageId: "msg-0004", pinned: "oui" })).toEqual({
      status: "success",
      message: "Message épinglé en haut de la liste.",
    });
    expect((await getMessage("msg-0004"))?.pinnedAt).not.toBeNull();

    expect(await setPin({ messageId: "msg-0004", pinned: "non" })).toEqual({
      status: "success",
      message: "Message désépinglé.",
    });
    expect((await getMessage("msg-0004"))?.pinnedAt).toBeNull();
  });

  it("signale important puis retire le signalement", async () => {
    expect(
      await setImportant({ messageId: "msg-0004", important: "oui" }),
    ).toEqual({
      status: "success",
      message: "Message signalé comme important.",
    });
    expect((await getMessage("msg-0004"))?.important).toBe(true);

    expect(
      await setImportant({ messageId: "msg-0004", important: "non" }),
    ).toEqual({
      status: "success",
      message: "Signalement « important » retiré.",
    });
  });

  it("une bascule déjà dans l'état demandé ne réécrit rien", async () => {
    // msg-0001 est épinglé et important dans les fixtures.
    revalidatePath.mockClear();
    expect(await setPin({ messageId: "msg-0001", pinned: "oui" })).toEqual({
      status: "success",
      message: "Déjà épinglé.",
    });
    expect(
      await setImportant({ messageId: "msg-0001", important: "oui" }),
    ).toEqual({ status: "success", message: "Déjà signalé." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse une valeur de bascule qui n'est ni « oui » ni « non »", async () => {
    for (const value of ["true", "1", ""]) {
      expect(
        await setPin({ messageId: "msg-0004", pinned: value }),
      ).toMatchObject({ status: "error" });
    }
  });
});
