import { describe, expect, it } from "vitest";
import {
  assignStaffSchema,
  changeStatusSchema,
  orderFiltersSchema,
  orderIdSchema,
  parseOrderFilters,
  parsePage,
  parsePeriodInput,
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
      nextStatus: "preparing",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        orderId: "cmd-0001",
        nextStatus: "preparing",
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
      nextStatus: "preparing",
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
      changeStatusSchema.safeParse({ nextStatus: "preparing" }).success,
    ).toBe(false);
  });

  it("ignore un champ en trop sans le laisser passer dans data", () => {
    const result = changeStatusSchema.safeParse({
      orderId: "cmd-0001",
      nextStatus: "preparing",
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
        nextStatus: ["preparing", "cancelled"],
      }).success,
    ).toBe(false);
  });
});

describe("parseOrderFilters", () => {
  it("sans paramètre, ne filtre rien", () => {
    expect(parseOrderFilters({})).toEqual({});
  });

  it("traduit les clés d'URL françaises en clés de code", () => {
    expect(
      parseOrderFilters({
        q: "  Benali ",
        statut: "preparing",
        du: "2026-09-01",
        au: "2026-09-07",
        preparateur: "stf-0005",
        livreur: "stf-0001",
      }),
    ).toEqual({
      query: "Benali",
      status: "preparing",
      from: "2026-09-01",
      to: "2026-09-07",
      preparerId: "stf-0005",
      driverId: "stf-0001",
    });
  });

  it("« aucun » demande les commandes sans personne affectée, vide ne filtre pas", () => {
    const result = parseOrderFilters({ preparateur: "aucun", livreur: "" });
    expect(result.preparerId).toBeNull();
    expect(result.driverId).toBeUndefined();
  });

  it("une période inversée n'est PAS appliquée (l'écran l'annonce), une seule date = ce jour-là", () => {
    expect(parseOrderFilters({ du: "2026-09-08", au: "2026-09-01" })).toEqual(
      {},
    );
    expect(parseOrderFilters({ du: "2026-09-08" })).toMatchObject({
      from: "2026-09-08",
      to: "2026-09-08",
    });
    expect(parseOrderFilters({ au: "2026-09-08" })).toMatchObject({
      from: "2026-09-08",
      to: "2026-09-08",
    });
  });

  it("lit encore ?date= (liens existants) comme un seul jour, du/au prioritaires", () => {
    expect(parseOrderFilters({ date: "2026-09-08" })).toMatchObject({
      from: "2026-09-08",
      to: "2026-09-08",
    });
    expect(
      parseOrderFilters({ date: "2026-09-08", du: "2026-09-01" }),
    ).toMatchObject({ from: "2026-09-01", to: "2026-09-01" });
  });

  it("ignore une recherche vide ou trop longue", () => {
    expect(parseOrderFilters({ q: "   " }).query).toBeUndefined();
    expect(parseOrderFilters({ q: "x".repeat(101) }).query).toBeUndefined();
  });

  it("ignore un statut inconnu, un paramètre répété, une date impossible", () => {
    expect(
      parseOrderFilters({
        statut: "foo",
        q: ["a", "b"],
        livreur: ["stf-0001", "stf-0002"],
        du: "08/09/2026",
        au: "2026-13-01",
      }),
    ).toEqual({});
  });

  it("ignore les clés inconnues comme simuler", () => {
    const result = parseOrderFilters({ simuler: "vide", statut: "cancelled" });
    expect(result).toEqual({ status: "cancelled" });
    expect("simuler" in result).toBe(false);
  });

  it("ne lève jamais sur un objet, même entièrement invalide", () => {
    expect(() =>
      parseOrderFilters({ statut: "x", du: "y", autre: ["z"] }),
    ).not.toThrow();
  });

  it("orderFiltersSchema garde une valeur valide à côté d'une invalide", () => {
    expect(
      orderFiltersSchema.parse({ statut: "foo", du: "2026-09-08" }),
    ).toMatchObject({ status: undefined, from: "2026-09-08" });
  });
});

describe("parsePeriodInput", () => {
  it("rend la saisie telle quelle, la période effective et l'erreur", () => {
    expect(parsePeriodInput({})).toEqual({ range: null, error: null });
    expect(parsePeriodInput({ du: "2026-09-05", au: "2026-09-09" })).toEqual({
      from: "2026-09-05",
      to: "2026-09-09",
      range: { from: "2026-09-05", to: "2026-09-09" },
      error: null,
    });
    expect(parsePeriodInput({ du: "2026-09-09", au: "2026-09-05" })).toEqual({
      from: "2026-09-09",
      to: "2026-09-05",
      range: null,
      error: "inverted",
    });
  });

  it("ignore une date impossible comme un champ vide, lit ?date= seul", () => {
    expect(parsePeriodInput({ du: "08/09/2026", au: "2026-09-09" })).toEqual({
      from: undefined,
      to: "2026-09-09",
      range: { from: "2026-09-09", to: "2026-09-09" },
      error: null,
    });
    expect(parsePeriodInput({ date: "2026-09-08" }).range).toEqual({
      from: "2026-09-08",
      to: "2026-09-08",
    });
    expect(parsePeriodInput({ du: ["2026-09-05", "2026-09-06"] })).toEqual({
      range: null,
      error: null,
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
        role: "preparer",
        staffId: "stf-0005",
        expectedStaffId: "",
      }).expectedStaffId,
    ).toBeNull();
    expect(
      assignStaffSchema.parse({
        orderId: "cmd-0001",
        role: "preparer",
        staffId: "",
        expectedStaffId: " stf-0006 ",
      }).expectedStaffId,
    ).toBe("stf-0006");
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
