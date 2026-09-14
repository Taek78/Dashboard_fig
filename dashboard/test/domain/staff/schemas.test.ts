import { describe, expect, it } from "vitest";
import {
  deleteStaffSchema,
  parseStaffKind,
  staffInputSchema,
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
