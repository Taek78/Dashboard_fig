import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  allowedTransitions,
  canTransition,
  type OrderStatus,
  statusPath,
} from "@/domain/orders/status";

/*
 * Teste src/domain/orders/status.ts : la machine d'états en liste blanche.
 * On énumère les passages autorisés ici, indépendamment de la matrice du code :
 * si quelqu'un modifie ORDER_TRANSITIONS, ce test le signale et force à relire
 * la décision (questions client Q4, Q7/Q9 dans docs/branchements.md).
 */
const ALLOWED: ReadonlyArray<[OrderStatus, OrderStatus]> = [
  ["pending", "confirmed"],
  ["pending", "cancelled"],
  ["confirmed", "preparing"],
  ["confirmed", "cancelled"],
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

  it("refuse tous les autres couples (36 couples testés)", () => {
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
  });

  it("n'autorise aucun retour arrière ni saut de fin", () => {
    expect(canTransition("preparing", "confirmed")).toBe(false);
    expect(canTransition("delivering", "cancelled")).toBe(false);
    expect(canTransition("pending", "delivered")).toBe(false);
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
    const first = allowedTransitions("pending");
    first.push("delivered");
    expect(allowedTransitions("pending")).toEqual(["confirmed", "cancelled"]);
    expect(canTransition("pending", "delivered")).toBe(false);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("a un libellé français non vide pour chaque statut", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});

describe("statusPath", () => {
  it("suit le cycle nominal jusqu'au statut, et pending → cancelled pour une annulation", () => {
    expect(statusPath("pending")).toEqual(["pending"]);
    expect(statusPath("preparing")).toEqual([
      "pending",
      "confirmed",
      "preparing",
    ]);
    expect(statusPath("delivered")).toEqual([
      "pending",
      "confirmed",
      "preparing",
      "delivering",
      "delivered",
    ]);
    expect(statusPath("cancelled")).toEqual(["pending", "cancelled"]);
  });
});
