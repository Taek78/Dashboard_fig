import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Teste src/app/(dashboard)/commandes/[id]/actions.ts de bout en bout sur la
 * base de TEST : changement de statut (session → rôle → zod → relecture →
 * règle → écriture conditionnelle → revalidation) et affectation de l'équipe.
 * Chaque test dans une transaction annulée : il repart des fixtures.
 *
 * Session simulée (rôle pilotable) ; server-only, next/cache et le journal
 * neutralisés ; revalidatePath espionné (on vérifie qu'il est appelé, pas ce
 * qu'il fait : c'est Next).
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
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { assignOrderStaff, changeOrderStatus } =
  await import("@/app/(dashboard)/commandes/[id]/actions");
const { getOrder, getOrderEvents } = await import("@/data/orders");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

const run = (fields: Record<string, string | string[]>) =>
  changeOrderStatus(idleActionResult, form(fields));
const assign = (fields: Record<string, string>) =>
  assignOrderStaff(idleActionResult, form(fields));

beforeEach(() => {
  session.role = "gestionnaire";
  revalidatePath.mockClear();
});

describe("changeOrderStatus", () => {
  it("refuse le rôle lecture avant même de valider l'entrée", async () => {
    session.role = "lecture";
    expect(
      await run({ orderId: "cmd-0001", nextStatus: "delivering" }),
    ).toEqual({
      status: "error",
      message:
        "Vous n'avez pas les droits pour modifier le statut d'une commande.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("expédie une commande en préparation, trace l'historique et revalide", async () => {
    expect(
      await run({ orderId: "cmd-0001", nextStatus: "delivering" }),
    ).toEqual({ status: "success", message: "Statut mis à jour : Expédiée." });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(await getOrderEvents("cmd-0001")).toMatchObject([
      {
        from: "preparing",
        to: "delivering",
        actor: { id: "usr-0002", name: "Gestion E2E" },
      },
    ]);
  });

  it("refuse une transition hors liste blanche avec un message français", async () => {
    const result = await run({ orderId: "cmd-0001", nextStatus: "delivered" });
    expect(result).toEqual({
      status: "error",
      message:
        "Le passage de « En préparation » à « Livrée » n'est pas autorisé.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse un statut inconnu (zod), dont l'ancien « pending »", async () => {
    for (const nextStatus of ["refunded", "pending"]) {
      expect(await run({ orderId: "cmd-0001", nextStatus })).toEqual({
        status: "error",
        message: "Le statut choisi n'est pas valide.",
      });
    }
  });

  it("refuse un orderId vide et signale une commande inexistante", async () => {
    expect(
      (await run({ orderId: "   ", nextStatus: "delivering" })).status,
    ).toBe("error");
    expect(
      await run({ orderId: "cmd-9999", nextStatus: "delivering" }),
    ).toEqual({ status: "error", message: "Cette commande n'existe plus." });
  });

  it("est idempotente : redemander le statut courant est un succès sans écriture", async () => {
    expect(await run({ orderId: "cmd-0002", nextStatus: "preparing" })).toEqual(
      { status: "success", message: "La commande est déjà à ce statut." },
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ignore un statut courant envoyé par le formulaire : seul l'état relu compte", async () => {
    const result = await run({
      orderId: "cmd-0001",
      currentStatus: "delivering",
      nextStatus: "delivered",
    });
    expect(result.status).toBe("error");
  });

  it("enchaîne expédiée puis livrée et refuse de sortir d'un état terminal", async () => {
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    expect(
      (await run({ orderId: "cmd-0001", nextStatus: "delivered" })).status,
    ).toBe("success");
    expect(
      (
        await run({
          orderId: "cmd-0001",
          nextStatus: "cancelled",
          reason: "stock",
        })
      ).status,
    ).toBe("error");
  });

  it("une commande expédiée ne s'annule plus", async () => {
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "cancelled",
        reason: "stock",
      }),
    ).toEqual({
      status: "error",
      message: "Le passage de « Expédiée » à « Annulée » n'est pas autorisé.",
    });
  });

  it("annuler exige un motif, et une précision pour « Autre »", async () => {
    const noReason = await run({
      orderId: "cmd-0001",
      nextStatus: "cancelled",
    });
    expect(noReason.status).toBe("error");
    if (noReason.status === "error") {
      expect(noReason.message).toContain("motif d'annulation");
    }
    expect(
      (
        await run({
          orderId: "cmd-0001",
          nextStatus: "cancelled",
          reason: "other",
          detail: "  ",
        })
      ).status,
    ).toBe("error");
    expect(
      (
        await run({
          orderId: "cmd-0001",
          nextStatus: "cancelled",
          reason: "other",
          detail: "x".repeat(101),
        })
      ).status,
    ).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();

    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "cancelled",
        reason: "other",
        detail: " Client absent ",
      }),
    ).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Autre : Client absent.",
    });
    expect((await getOrder("cmd-0001"))?.cancellation).toEqual({
      reason: "other",
      detail: "Client absent",
    });
  });

  it("le motif est ignoré pour un statut autre qu'annulée", async () => {
    const result = await run({
      orderId: "cmd-0001",
      nextStatus: "delivering",
      reason: "stock",
      detail: "peu importe",
    });
    expect(result.status).toBe("success");
    expect((await getOrder("cmd-0001"))?.cancellation).toBeNull();
  });

  it("sur un champ répété, ne garde que la dernière valeur, elle aussi validée", async () => {
    // Object.fromEntries(formData) conserve la dernière occurrence d'une clé.
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: ["delivering", "cancelled"],
        reason: "stock",
      }),
    ).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Stock insuffisant.",
    });
    expect(
      (
        await run({
          orderId: "cmd-0002",
          nextStatus: ["delivering", "delivered"],
        })
      ).status,
    ).toBe("error");
  });
});

describe("assignOrderStaff", () => {
  it("affecte un préparateur du bon métier et l'écrit sur la commande", async () => {
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "preparer",
        staffId: "stf-0006",
      }),
    ).toEqual({ status: "success", message: "Préparateur : Fatou Ndiaye." });
    expect((await getOrder("cmd-0001"))?.preparer).toEqual({
      id: "stf-0006",
      name: "Fatou Ndiaye",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("précondition : si l'affectation a changé depuis l'affichage, rien n'est écrasé", async () => {
    // L'écran montrait « Non affecté » ; entre-temps quelqu'un a choisi Julien.
    await assign({
      orderId: "cmd-0001",
      role: "preparer",
      staffId: "stf-0005",
    });
    revalidatePath.mockClear();
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "preparer",
        staffId: "stf-0006",
        expectedStaffId: "",
      }),
    ).toEqual({
      status: "error",
      message:
        "L'affectation a été modifiée entre-temps par quelqu'un d'autre : la liste a été actualisée.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect((await getOrder("cmd-0001"))?.preparer?.id).toBe("stf-0005");

    expect(
      await assign({
        orderId: "cmd-0001",
        role: "preparer",
        staffId: "stf-0006",
        expectedStaffId: "stf-0005",
      }),
    ).toEqual({ status: "success", message: "Préparateur : Fatou Ndiaye." });
  });

  it("retire l'affectation avec un id vide", async () => {
    expect(
      await assign({ orderId: "cmd-0003", role: "preparer", staffId: "" }),
    ).toEqual({ status: "success", message: "Préparateur retiré." });
    expect((await getOrder("cmd-0003"))?.preparer).toBeNull();
  });

  it("refuse le mauvais métier, une personne partie ou inconnue, une commande terminée, le rôle livreur", async () => {
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "driver",
        staffId: "stf-0005",
      }),
    ).toEqual({
      status: "error",
      message: "Cette personne n'a pas le bon métier pour ce rôle.",
    });
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "driver",
        staffId: "stf-0010",
      }),
    ).toMatchObject({ status: "error" });
    expect(
      await assign({
        orderId: "cmd-0005",
        role: "driver",
        staffId: "stf-0001",
      }),
    ).toEqual({
      status: "error",
      message: "Une commande terminée ne peut plus être affectée.",
    });
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "driver",
        staffId: "stf-9999",
      }),
    ).toEqual({
      status: "error",
      message: "Cette personne n'est plus dans l'équipe.",
    });
    session.role = "livreur";
    expect(
      await assign({
        orderId: "cmd-0001",
        role: "driver",
        staffId: "stf-0001",
      }),
    ).toEqual({
      status: "error",
      message: "Vous n'avez pas les droits pour affecter l'équipe.",
    });
    expect((await getOrder("cmd-0001"))?.driver).toBeNull();
  });
});
