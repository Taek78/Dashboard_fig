import { describe, expect, it } from "vitest";
import {
  deleteStaffSchema,
  parseStaffKind,
  staffInputSchema,
  parseStaffHistoryFilters,
  parseStaffSearch,
} from "@/domain/staff/schemas";

const base = {
  kind: "livreur",
  firstName: " Malik ",
  lastName: "Dembélé",
  email: "Malik.Dembele@Example.invalid",
  phone: "06 39 98 90 01",
  shift: "matin",
  availability: "disponible",
  workDays: ["ven", "lun", "lun"],
  startedAt: "2024-11-04",
  notes: "  ",
  active: "on",
};

describe("staffInputSchema", () => {
  it("normalise : trim, e-mail en minuscules, jours dédoublonnés dans l'ordre, notes vides → null", () => {
    const parsed = staffInputSchema.parse(base);
    expect(parsed).toEqual({
      kind: "livreur",
      firstName: "Malik",
      lastName: "Dembélé",
      email: "malik.dembele@example.invalid",
      phone: "06 39 98 90 01",
      shift: "matin",
      availability: "disponible",
      workDays: ["lun", "ven"],
      startedAt: "2024-11-04",
      notes: null,
      active: true,
    });
  });

  it("une case décochée = inactif, aucun jour = tableau vide", () => {
    const { active, workDays, ...rest } = base;
    void active;
    void workDays;
    const parsed = staffInputSchema.parse(rest);
    expect(parsed.active).toBe(false);
    expect(parsed.workDays).toEqual([]);
  });

  it("refuse un métier inconnu, un e-mail invalide, un téléphone ou une date mal formés", () => {
    expect(staffInputSchema.safeParse({ ...base, kind: "chef" }).success).toBe(
      false,
    );
    expect(
      staffInputSchema.safeParse({ ...base, email: "pas-un-mail" }).success,
    ).toBe(false);
    expect(
      staffInputSchema.safeParse({ ...base, phone: "appelez-moi" }).success,
    ).toBe(false);
    expect(
      staffInputSchema.safeParse({ ...base, startedAt: "04/11/2024" }).success,
    ).toBe(false);
    expect(
      staffInputSchema.safeParse({ ...base, workDays: ["lun", "xyz"] }).success,
    ).toBe(false);
  });
});

describe("parseStaffKind / deleteStaffSchema", () => {
  it("lit ?type= avec tolérance", () => {
    expect(parseStaffKind({ type: "preparateur" })).toBe("preparateur");
    expect(parseStaffKind({ type: "autre" })).toBeUndefined();
    expect(parseStaffKind({})).toBeUndefined();
  });

  it("la suppression exige le mot SUPPRIMER", () => {
    expect(
      deleteStaffSchema.safeParse({ staffId: "stf-0001", confirm: "SUPPRIMER" })
        .success,
    ).toBe(true);
    expect(
      deleteStaffSchema.safeParse({ staffId: "stf-0001", confirm: "oui" })
        .success,
    ).toBe(false);
  });
});

describe("parseStaffSearch", () => {
  it("lit recherche et filtres de la section Personnel", () => {
    expect(
      parseStaffSearch({
        q: "  malik ",
        type: "livreur",
        dispo: "conge",
        creneau: "matin",
        jour: "sam",
        presence: "actifs",
      }),
    ).toEqual({
      query: "malik",
      kind: "livreur",
      availability: "conge",
      shift: "matin",
      workDay: "sam",
      presence: "actifs",
    });
  });

  it("ignore les valeurs vides, inconnues, répétées ou trop longues", () => {
    expect(
      parseStaffSearch({
        q: "   ",
        type: "chef",
        dispo: ["disponible", "conge"],
        creneau: "nuit",
        jour: "lundi",
        presence: "tous",
      }),
    ).toEqual({});
    expect(parseStaffSearch({ q: "x".repeat(65) }).query).toBeUndefined();
  });
});

describe("parseStaffHistoryFilters", () => {
  it("lit recherche, rôle, statut et période ; ignore le reste", () => {
    expect(
      parseStaffHistoryFilters({
        q: " FIG ",
        role: "livraison",
        statut: "delivered",
        du: "2026-09-01",
        au: "2026-09-07",
      }),
    ).toEqual({
      query: "FIG",
      role: "livraison",
      status: "delivered",
      from: "2026-09-01",
      to: "2026-09-07",
    });
    expect(parseStaffHistoryFilters({ role: "autre" }).role).toBeUndefined();
    expect(parseStaffHistoryFilters({ role: ["a", "b"] })).toEqual({});
  });

  it("suit la règle commune des périodes : inversée = rien, une date = ce jour-là", () => {
    expect(
      parseStaffHistoryFilters({ du: "2026-09-07", au: "2026-09-01" }),
    ).toEqual({});
    expect(parseStaffHistoryFilters({ du: "2026-09-07" })).toEqual({
      from: "2026-09-07",
      to: "2026-09-07",
    });
  });
});
