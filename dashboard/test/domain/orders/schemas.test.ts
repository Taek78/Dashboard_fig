import { describe, expect, it } from "vitest";
import {
  changeStatusSchema,
  orderFiltersSchema,
  orderIdSchema,
  parseOrderFilters,
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
