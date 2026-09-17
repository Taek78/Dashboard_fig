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
const { getOrderNotifications } = await import("@/data/notifications");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

/* La case « Notifier le client » est cochée par défaut dans le formulaire : run() l'envoie, sauf mention contraire. */
const run = (fields: Record<string, string | string[]>) =>
  changeOrderStatus(idleActionResult, form({ notify: "1", ...fields }));
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
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Expédiée.",
      notified: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(await getOrderEvents("cmd-0001")).toMatchObject([
      {
        from: "preparing",
        to: "delivering",
        actor: { id: "usr-0002", name: "Gestion E2E" },
      },
    ]);
  });

  it("dépose une notification pour le client qui l'a autorisée, avec le motif d'une annulation", async () => {
    // cli-0001 (Amel) : autorisée. cmd-0001 est en préparation.
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    expect(await getOrderNotifications("cmd-0001")).toMatchObject([
      {
        customerId: "cli-0001",
        orderStatus: "delivering",
        title: "Commande FIG-260907-001",
        body: "Votre commande FIG-260907-001 est en route : votre livreur arrive sur le créneau choisi.",
        sentAt: null,
      },
    ]);
    // cli-0002 (Théo) : autorisée ; l'annulation reprend le motif.
    await run({
      orderId: "cmd-0002",
      nextStatus: "cancelled",
      reason: "other",
      detail: "Client absent",
    });
    expect((await getOrderNotifications("cmd-0002"))[0]?.body).toBe(
      "Votre commande FIG-260907-002 a été annulée. Motif : Autre : Client absent.",
    );
  });

  it("ne dépose rien pour un client qui n'a pas autorisé les notifications d'état", async () => {
    // cli-0009 (Yanis) : offres seulement. cmd-0010 est en préparation.
    expect(
      await run({ orderId: "cmd-0010", nextStatus: "delivering" }),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Expédiée.",
      notified: false,
    });
    expect(await getOrderNotifications("cmd-0010")).toEqual([]);
  });

  it("plus de règle d'étape : livrée directement, retour en préparation, reprise d'une annulée, une notification à chaque fois", async () => {
    expect(await run({ orderId: "cmd-0001", nextStatus: "delivered" })).toEqual(
      {
        status: "success",
        message: "Statut mis à jour : Livrée.",
        notified: true,
      },
    );
    expect(await run({ orderId: "cmd-0001", nextStatus: "preparing" })).toEqual(
      {
        status: "success",
        message: "Statut mis à jour : En préparation.",
        notified: true,
      },
    );
    expect(
      (
        await run({
          orderId: "cmd-0001",
          nextStatus: "cancelled",
          reason: "stock",
        })
      ).status,
    ).toBe("success");
    expect(
      await run({ orderId: "cmd-0001", nextStatus: "delivering" }),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Expédiée.",
      notified: true,
    });
    const order = await getOrder("cmd-0001");
    expect(order?.status).toBe("delivering");
    // La reprise d'une annulée efface son motif.
    expect(order?.cancellation).toBeNull();
    const events = (await getOrderEvents("cmd-0001")).map(
      (e) => `${e.from}>${e.to}`,
    );
    expect(events).toHaveLength(4);
    expect(events).toEqual(
      expect.arrayContaining([
        "preparing>delivered",
        "delivered>preparing",
        "preparing>cancelled",
        "cancelled>delivering",
      ]),
    );
    // Amel a autorisé les notifications d'état : une par changement, le retour en préparation compris.
    const notified = (await getOrderNotifications("cmd-0001")).map(
      (n) => n.orderStatus,
    );
    expect(notified).toHaveLength(4);
    expect(notified).toEqual(
      expect.arrayContaining([
        "delivered",
        "preparing",
        "cancelled",
        "delivering",
      ]),
    );
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
    expect(result.status).toBe("success");
    // L'événement part du statut RELU (en préparation), pas de celui prétendu.
    expect(await getOrderEvents("cmd-0001")).toMatchObject([
      { from: "preparing", to: "delivered" },
    ]);
  });

  it("enchaîne expédiée puis livrée, et annule même une commande livrée, avec son motif", async () => {
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    expect(
      (await run({ orderId: "cmd-0001", nextStatus: "delivered" })).status,
    ).toBe("success");
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "cancelled",
        reason: "stock",
      }),
    ).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Stock insuffisant.",
      notified: true,
    });
    expect((await getOrder("cmd-0001"))?.status).toBe("cancelled");
  });

  it("une commande expédiée s'annule aussi, toujours avec un motif", async () => {
    await run({ orderId: "cmd-0001", nextStatus: "delivering" });
    expect(
      (await run({ orderId: "cmd-0001", nextStatus: "cancelled" })).status,
    ).toBe("error");
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "cancelled",
        reason: "stock",
      }),
    ).toEqual({
      status: "success",
      message:
        "Commande annulée. Motif communiqué au client : Stock insuffisant.",
      notified: true,
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
      notified: true,
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
      notified: true,
    });
    expect(
      await run({
        orderId: "cmd-0002",
        nextStatus: ["delivering", "delivered"],
      }),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Livrée.",
      notified: true,
    });
    expect((await getOrder("cmd-0002"))?.status).toBe("delivered");
  });

  it("case « Notifier le client » décochée : aucune notification, même pour un client qui l'a autorisée, et le message le dit", async () => {
    // cli-0001 (Amel) a autorisé les notifications d'état.
    expect(
      await run({ orderId: "cmd-0001", nextStatus: "delivering", notify: "0" }),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Expédiée.",
      notified: false,
    });
    // Absente (un formulaire n'envoie pas une case décochée) : pareil.
    expect(
      await changeOrderStatus(
        idleActionResult,
        form({ orderId: "cmd-0001", nextStatus: "delivered" }),
      ),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : Livrée.",
      notified: false,
    });
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "cancelled",
        reason: "stock",
        notify: "0",
      }),
    ).toEqual({
      status: "success",
      message: "Commande annulée. Motif enregistré : Stock insuffisant.",
      notified: false,
    });
    expect(await getOrderNotifications("cmd-0001")).toEqual([]);
    expect((await getOrderEvents("cmd-0001")).length).toBe(3);

    // Recochée : la notification repart.
    expect(
      await run({ orderId: "cmd-0001", nextStatus: "preparing", notify: "1" }),
    ).toEqual({
      status: "success",
      message: "Statut mis à jour : En préparation.",
      notified: true,
    });
    expect(
      (await getOrderNotifications("cmd-0001")).map((n) => n.orderStatus),
    ).toEqual(["preparing"]);

    // Une valeur inconnue est refusée avant toute écriture.
    expect(
      await run({
        orderId: "cmd-0001",
        nextStatus: "delivering",
        notify: "on",
      }),
    ).toEqual({
      status: "error",
      message: "Le statut choisi n'est pas valide.",
    });
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
