import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  allowedTransitions,
  canTransition,
  isFinished,
  statusPath,
} from "@/domain/orders/status";

/*
 * Teste src/domain/orders/status.ts. Depuis le 2026-09-17 (décision du
 * client), plus de règle d'étape : tout statut différent du courant est
 * permis. Si quelqu'un resserre la règle un jour, ce test le signale et force
 * à relire la décision.
 */
describe("canTransition", () => {
  it("autorise tout changement, y compris le retour arrière, le saut de fin et la reprise d'une annulée", () => {
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransition(from, to)).toBe(from !== to);
        checked += 1;
      }
    }
    expect(checked).toBe(ORDER_STATUSES.length ** 2);
    expect(canTransition("preparing", "delivered")).toBe(true);
    expect(canTransition("delivered", "preparing")).toBe(true);
    expect(canTransition("delivering", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "preparing")).toBe(true);
  });

  it("refuse seulement de rester sur le même statut", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("isFinished : livrée et annulée sont terminales (plus d'affectation tant qu'elles le restent)", () => {
    expect(isFinished("delivered")).toBe(true);
    expect(isFinished("cancelled")).toBe(true);
    expect(isFinished("preparing")).toBe(false);
    expect(isFinished("delivering")).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("renvoie les trois autres statuts, dans l'ordre de la liste", () => {
    expect(allowedTransitions("preparing")).toEqual([
      "delivering",
      "delivered",
      "cancelled",
    ]);
    expect(allowedTransitions("delivered")).toEqual([
      "preparing",
      "delivering",
      "cancelled",
    ]);
    expect(allowedTransitions("cancelled")).toEqual([
      "preparing",
      "delivering",
      "delivered",
    ]);
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
    first.pop();
    expect(allowedTransitions("preparing")).toHaveLength(3);
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
