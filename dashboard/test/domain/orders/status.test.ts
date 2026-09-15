import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  allowedTransitions,
  canTransition,
  isFinished,
  type OrderStatus,
  statusPath,
} from "@/domain/orders/status";

/*
 * Teste src/domain/orders/status.ts : la machine d'états en liste blanche.
 * On énumère les passages autorisés ici, indépendamment de la matrice du code :
 * si quelqu'un modifie ORDER_TRANSITIONS, ce test le signale et force à relire
 * la décision du client (trois états de parcours, 2026-09-15).
 */
const ALLOWED: ReadonlyArray<[OrderStatus, OrderStatus]> = [
  ["preparing", "delivering"],
  ["preparing", "cancelled"],
  ["delivering", "delivered"],
];

const isAllowed = (from: OrderStatus, to: OrderStatus) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

describe("canTransition", () => {
  it.each(ALLOWED)("autorise %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("refuse tous les autres couples (chaque couple testé)", () => {
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransition(from, to)).toBe(isAllowed(from, to));
        checked += 1;
      }
    }
    expect(checked).toBe(ORDER_STATUSES.length ** 2);
  });

  it("refuse de rester sur le même statut", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("n'autorise aucune sortie des statuts terminaux", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("delivered", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
    expect(isFinished("delivered")).toBe(true);
    expect(isFinished("cancelled")).toBe(true);
    expect(isFinished("preparing")).toBe(false);
    expect(isFinished("delivering")).toBe(false);
  });

  it("n'autorise aucun retour arrière, saut de fin ni annulation d'une commande expédiée", () => {
    expect(canTransition("delivering", "preparing")).toBe(false);
    expect(canTransition("delivering", "cancelled")).toBe(false);
    expect(canTransition("preparing", "delivered")).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("renvoie exactement les cibles de la liste blanche", () => {
    for (const from of ORDER_STATUSES) {
      const expected = ALLOWED.filter(([f]) => f === from).map(([, t]) => t);
      expect(allowedTransitions(from)).toEqual(expected);
    }
  });

  it("renvoie un tableau vide pour les statuts terminaux", () => {
    expect(allowedTransitions("delivered")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
  });

  it("est cohérente avec canTransition dans les deux sens", () => {
    for (const from of ORDER_STATUSES) {
      const targets = allowedTransitions(from);
      for (const to of ORDER_STATUSES) {
        expect(targets.includes(to)).toBe(canTransition(from, to));
      }
    }
  });

  it("renvoie une copie : la muter ne change pas l'appel suivant", () => {
    const first = allowedTransitions("preparing");
    first.push("delivered");
    expect(allowedTransitions("preparing")).toEqual([
      "delivering",
      "cancelled",
    ]);
    expect(canTransition("preparing", "delivered")).toBe(false);
  });
});

describe("ORDER_STATUSES", () => {
  it("trois états de parcours et l'annulation, sans « confirmée » ni « en attente »", () => {
    expect(ORDER_STATUSES).toEqual([
      "preparing",
      "delivering",
      "delivered",
      "cancelled",
    ]);
    for (const removed of ["confirmed", "pending"]) {
      expect((ORDER_STATUSES as readonly string[]).includes(removed)).toBe(
        false,
      );
    }
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("a un libellé français non vide pour chaque statut, « Expédiée » pour la livraison en cours", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
    expect(ORDER_STATUS_LABELS.delivering).toBe("Expédiée");
  });
});

describe("statusPath", () => {
  it("suit le cycle nominal depuis la préparation, et preparing → cancelled pour une annulation", () => {
    expect(statusPath("preparing")).toEqual(["preparing"]);
    expect(statusPath("delivering")).toEqual(["preparing", "delivering"]);
    expect(statusPath("delivered")).toEqual([
      "preparing",
      "delivering",
      "delivered",
    ]);
    expect(statusPath("cancelled")).toEqual(["preparing", "cancelled"]);
  });
});
