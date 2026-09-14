import { describe, expect, it } from "vitest";
import {
  assignStaffSchema,
  changeStatusSchema,
  orderFiltersSchema,
  orderIdSchema,
  parseOrderFilters,
  parsePage,
} from "@/domain/orders/schemas";

/*
 * Teste src/domain/orders/schemas.ts : la douane des entrées.
 * Écriture (changeStatusSchema) : tout ce qui est douteux est refusé.
 * Lecture (parseOrderFilters) : tout ce qui est douteux est ignoré, jamais refusé.
 */
describe("orderIdSchema", () => {
  it("accepte un id et retire les espaces autour", () => {
    expect(orderIdSchema.parse("  cmd-0001 ")).toBe("cmd-0001");
  });

  it("refuse le vide, les espaces seuls et plus de 64 caractères", () => {
    expect(orderIdSchema.safeParse("").success).toBe(false);
    expect(orderIdSchema.safeParse("   ").success).toBe(false);
    expect(orderIdSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(orderIdSchema.safeParse("x".repeat(64)).success).toBe(true);
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    expect(orderIdSchema.safeParse(42).success).toBe(false);
    expect(orderIdSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("changeStatusSchema", () => {
  it("accepte une entrée valide et renvoie les deux champs typés", () => {
    const result = changeStatusSchema.safeParse({
      orderId: "cmd-0001",
      nextStatus: "confirmed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        orderId: "cmd-0001",
        nextStatus: "confirmed",
        cancellation: null,
      });
    }
  });

  it("refuse un statut hors liste et désigne le champ fautif", () => {
    const result = changeStatusSchema.safeParse({
      orderId: "cmd-0001",
      nextStatus: "refunded",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["nextStatus"]);
    }
  });

  it("refuse un id vide et désigne le champ fautif", () => {
    const result = changeStatusSchema.safeParse({
      orderId: "  ",
      nextStatus: "confirmed",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["orderId"]);
    }
  });

  it("refuse un champ manquant", () => {
    expect(changeStatusSchema.safeParse({ orderId: "cmd-0001" }).success).toBe(
      false,
    );
    expect(
      changeStatusSchema.safeParse({ nextStatus: "confirmed" }).success,
    ).toBe(false);
  });

  it("ignore un champ en trop sans le laisser passer dans data", () => {
    const result = changeStatusSchema.safeParse({
      orderId: "cmd-0001",
      nextStatus: "confirmed",
      role: "admin",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("role" in result.data).toBe(false);
    }
  });

  it("annulée : motif requis, précision requise et bornée pour « autre »", () => {
    const base = { orderId: "cmd-0001", nextStatus: "cancelled" };
    const missing = changeStatusSchema.safeParse(base);
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.path).toEqual(["reason"]);
    }
    expect(changeStatusSchema.parse({ ...base, reason: "stock" })).toEqual({
      ...base,
      cancellation: { reason: "stock", detail: null },
    });
    expect(
      changeStatusSchema.parse({ ...base, reason: "stock", detail: "ignoré" })
        .cancellation,
    ).toEqual({ reason: "stock", detail: null });
    expect(
      changeStatusSchema.safeParse({ ...base, reason: "other" }).success,
    ).toBe(false);
    expect(
      changeStatusSchema.safeParse({ ...base, reason: "other", detail: " " })
        .success,
    ).toBe(false);
    expect(
      changeStatusSchema.safeParse({
        ...base,
        reason: "other",
        detail: "x".repeat(101),
      }).success,
    ).toBe(false);
    expect(
      changeStatusSchema.parse({ ...base, reason: "other", detail: " Absent " })
        .cancellation,
    ).toEqual({ reason: "other", detail: "Absent" });
    expect(
      changeStatusSchema.safeParse({ ...base, reason: "weather" }).success,
    ).toBe(false);
  });

  it("refuse un statut envoyé en tableau (paramètre répété)", () => {
    expect(
      changeStatusSchema.safeParse({
        orderId: "cmd-0001",
        nextStatus: ["confirmed", "cancelled"],
      }).success,
    ).toBe(false);
  });
});

describe("parseOrderFilters", () => {
  it("sans paramètre, ne filtre rien", () => {
    expect(parseOrderFilters({})).toEqual({
      status: undefined,
      date: undefined,
    });
  });

  it("traduit statut (URL) en status (code)", () => {
    expect(parseOrderFilters({ statut: "pending" })).toEqual({
      status: "pending",
      date: undefined,
    });
  });

  it("accepte une date AAAA-MM-JJ", () => {
    expect(parseOrderFilters({ date: "2026-09-08" }).date).toBe("2026-09-08");
  });

  it("ignore un statut inconnu au lieu d'échouer", () => {
    expect(parseOrderFilters({ statut: "foo" }).status).toBeUndefined();
  });

  it("ignore un paramètre répété (tableau)", () => {
    expect(
      parseOrderFilters({ statut: ["pending", "confirmed"] }).status,
    ).toBeUndefined();
  });

  it("ignore une date mal formée ou impossible", () => {
    expect(parseOrderFilters({ date: "08/09/2026" }).date).toBeUndefined();
    expect(parseOrderFilters({ date: "2026-13-01" }).date).toBeUndefined();
  });

  it("ignore les clés inconnues comme simuler", () => {
    const result = parseOrderFilters({ simuler: "vide", statut: "cancelled" });
    expect(result).toEqual({ status: "cancelled", date: undefined });
    expect("simuler" in result).toBe(false);
  });

  it("ne lève jamais sur un objet, même entièrement invalide", () => {
    expect(() =>
      parseOrderFilters({ statut: "x", date: "y", autre: ["z"] }),
    ).not.toThrow();
  });

  it("orderFiltersSchema garde une valeur valide à côté d'une invalide", () => {
    expect(
      orderFiltersSchema.parse({ statut: "foo", date: "2026-09-08" }),
    ).toEqual({
      status: undefined,
      date: "2026-09-08",
    });
  });
});

describe("parsePage", () => {
  it("lit un entier positif, sinon 1", () => {
    expect(parsePage({ page: "3" })).toBe(3);
    expect(parsePage({})).toBe(1);
    expect(parsePage({ page: "0" })).toBe(1);
    expect(parsePage({ page: "-2" })).toBe(1);
    expect(parsePage({ page: "abc" })).toBe(1);
    expect(parsePage({ page: ["2", "3"] })).toBe(1);
  });
});

describe("assignStaffSchema", () => {
  it("accepte un rôle connu et un id, ou une chaîne vide pour retirer", () => {
    expect(
      assignStaffSchema.parse({
        orderId: "cmd-0001",
        role: "preparer",
        staffId: " stf-0005 ",
      }),
    ).toEqual({ orderId: "cmd-0001", role: "preparer", staffId: "stf-0005" });
    expect(
      assignStaffSchema.parse({
        orderId: "cmd-0001",
        role: "driver",
        staffId: "",
      }).staffId,
    ).toBeNull();
  });

  it("refuse un rôle inconnu ou un orderId vide", () => {
    expect(
      assignStaffSchema.safeParse({
        orderId: "cmd-0001",
        role: "manager",
        staffId: "x",
      }).success,
    ).toBe(false);
    expect(
      assignStaffSchema.safeParse({ orderId: "", role: "driver", staffId: "x" })
        .success,
    ).toBe(false);
  });
});
