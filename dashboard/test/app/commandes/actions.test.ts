import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_LATENCY_MS,
  ordersMock,
  resetOrdersMock,
} from "@/data/orders.mock";

/*
 * Session simulée : getCurrentUser() (Auth.js) est remplacé par un
 * utilisateur de test dont le rôle est pilotable par cas (session.role).
 */
const session = vi.hoisted(() => ({ role: "gestionnaire" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-test",
    name: "Testeur",
    role: session.role,
  }),
}));

/*
 * Teste src/app/(dashboard)/commandes/[id]/actions.ts de bout en bout : les 9
 * étapes de changeOrderStatus contre le mock mutable.
 *
 * EXCEPTION documentée à la règle « un test n'importe jamais un module
 * server-only » : on neutralise "server-only" et "next/cache" avec vi.mock, ce qui
 * permet de charger la façade et l'action sous Vitest ; la session est simulée
 * ci-dessus (rôle pilotable).
 * revalidatePath est remplacé par un espion : on vérifie qu'il est appelé, pas ce
 * qu'il fait (c'est Next).
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATA_SOURCE: "mock" }) }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const { changeOrderStatus } =
  await import("@/app/(dashboard)/commandes/[id]/actions");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

async function run(fields: Record<string, string | string[]>) {
  const promise = changeOrderStatus(idleActionResult, form(fields));
  // Jusqu'à trois accès au mock (getOrder + updateOrderStatus + relecture) : on avance large.
  await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS * 3);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  session.role = "gestionnaire";
  resetOrdersMock();
  revalidatePath.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("changeOrderStatus", () => {
  it("refuse le rôle lecture avant même de valider l'entrée", async () => {
    session.role = "lecture";
    const result = await run({ orderId: "cmd-0001", nextStatus: "confirmed" });
    expect(result).toEqual({
      status: "error",
      message:
        "Vous n'avez pas les droits pour modifier le statut d'une commande.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passe une commande en attente à confirmée et invalide /commandes", async () => {
    const result = await run({ orderId: "cmd-0001", nextStatus: "confirmed" });
    expect(result).toEqual({
      status: "success",
      message: "Statut mis à jour : Confirmée.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

    const history = ordersMock.getOrderEvents("cmd-0001");
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
    expect(await history).toMatchObject([
      {
        from: "pending",
        to: "confirmed",
        actor: { id: "usr-test", name: "Testeur" },
      },
    ]);
  });

  it("refuse une transition hors liste blanche avec un message français", async () => {
    const result = await run({ orderId: "cmd-0001", nextStatus: "delivered" });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe(
        "Le passage de « En attente » à « Livrée » n'est pas autorisé.",
      );
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuse un statut inconnu (zod) sans toucher au mock", async () => {
    const result = await run({ orderId: "cmd-0001", nextStatus: "refunded" });
    expect(result).toEqual({
      status: "error",
      message: "Le statut choisi n'est pas valide.",
    });
  });

  it("refuse un orderId vide", async () => {
    const result = await run({ orderId: "   ", nextStatus: "confirmed" });
    expect(result.status).toBe("error");
  });

  it("signale une commande inexistante", async () => {
    const result = await run({ orderId: "cmd-9999", nextStatus: "confirmed" });
    expect(result).toEqual({
      status: "error",
      message: "Cette commande n'existe plus.",
    });
  });

  it("est idempotente : redemander le statut courant est un succès sans écriture", async () => {
    const result = await run({ orderId: "cmd-0002", nextStatus: "confirmed" });
    expect(result).toEqual({
      status: "success",
      message: "La commande est déjà à ce statut.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ignore un statut courant envoyé par le formulaire : seul l'état relu compte", async () => {
    // Le client prétend que la commande est « delivering » ; elle est « pending ».
    const result = await run({
      orderId: "cmd-0001",
      currentStatus: "delivering",
      nextStatus: "delivered",
    });
    expect(result.status).toBe("error");
  });

  it("enchaîne les transitions et refuse de sortir d'un état terminal", async () => {
    await run({ orderId: "cmd-0001", nextStatus: "confirmed" });
    await run({ orderId: "cmd-0001", nextStatus: "preparing" });
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    const delivered = await run({
      orderId: "cmd-0001",
      nextStatus: "delivered",
    });
    expect(delivered.status).toBe("success");

    const reopened = await run({
      orderId: "cmd-0001",
      nextStatus: "cancelled",
    });
    expect(reopened.status).toBe("error");
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
    const noDetail = await run({
      orderId: "cmd-0001",
      nextStatus: "cancelled",
      reason: "other",
      detail: "  ",
    });
    expect(noDetail.status).toBe("error");
    const tooLong = await run({
      orderId: "cmd-0001",
      nextStatus: "cancelled",
      reason: "other",
      detail: "x".repeat(101),
    });
    expect(tooLong.status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();

    const ok = await run({
      orderId: "cmd-0001",
      nextStatus: "cancelled",
      reason: "other",
      detail: " Client absent ",
    });
    expect(ok).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Autre : Client absent.",
    });
    const order = ordersMock.getOrder("cmd-0001");
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
    expect((await order)?.cancellation).toEqual({
      reason: "other",
      detail: "Client absent",
    });
  });

  it("le motif est ignoré pour un statut autre qu'annulée", async () => {
    const result = await run({
      orderId: "cmd-0001",
      nextStatus: "confirmed",
      reason: "stock",
      detail: "peu importe",
    });
    expect(result.status).toBe("success");
    const order = ordersMock.getOrder("cmd-0001");
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
    expect((await order)?.cancellation).toBeNull();
  });

  it("sur un champ répété, ne garde que la dernière valeur, elle aussi validée", async () => {
    // Object.fromEntries(formData) conserve la dernière occurrence d'une clé :
    // « cancelled » ici. Elle passe par zod et canTransition comme n'importe quelle
    // valeur : pas de contournement possible via la répétition.
    const result = await run({
      orderId: "cmd-0001",
      nextStatus: ["confirmed", "cancelled"],
      reason: "stock",
    });
    expect(result).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Stock insuffisant.",
    });

    resetOrdersMock();
    const forged = await run({
      orderId: "cmd-0001",
      nextStatus: ["confirmed", "delivered"],
    });
    expect(forged.status).toBe("error");
  });
});
