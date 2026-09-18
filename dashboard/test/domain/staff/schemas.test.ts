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
      leftAt: null,
    });
  });

  it("aucun jour = tableau vide", () => {
    const { workDays, ...rest } = base;
    void workDays;
    expect(staffInputSchema.parse(rest).workDays).toEqual([]);
  });

  it("« Parti de l'entreprise » cochée : inactif avec sa date de sortie", () => {
    expect(
      staffInputSchema.parse({
        ...base,
        departed: "on",
        leftAt: "2026-09-30",
      }),
    ).toMatchObject({ active: false, leftAt: "2026-09-30" });
    // Sortie le jour même de l'entrée : acceptée.
    expect(
      staffInputSchema.parse({
        ...base,
        departed: "on",
        leftAt: "2024-11-04",
      }).leftAt,
    ).toBe("2024-11-04");
  });

  it("case cochée : date de sortie obligatoire, valide et pas avant l'entrée", () => {
    const issue = (fields: Record<string, unknown>) =>
      staffInputSchema.safeParse({ ...base, departed: "on", ...fields }).error
        ?.issues[0];
    expect(issue({})).toMatchObject({
      path: ["leftAt"],
      message: "Date de sortie obligatoire pour une personne partie.",
    });
    expect(issue({ leftAt: "" })?.path).toEqual(["leftAt"]);
    expect(issue({ leftAt: "30/09/2026" })?.path).toEqual(["leftAt"]);
    expect(issue({ leftAt: "2024-11-03" })).toMatchObject({
      path: ["leftAt"],
      message: "La date de sortie ne précède pas la date d'entrée.",
    });
  });

  it("case décochée : dans l'entreprise, une date envoyée est ignorée", () => {
    expect(
      staffInputSchema.parse({ ...base, leftAt: "2026-09-30" }),
    ).toMatchObject({ active: true, leftAt: null });
  });

  it("accepte le créneau 24 h/24 et l'arrêt maladie", () => {
    expect(
      staffInputSchema.parse({
        ...base,
        shift: "h24",
        availability: "arret_maladie",
      }),
    ).toMatchObject({ shift: "h24", availability: "arret_maladie" });
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

  it("la suppression exige la confirmation de la fenêtre (confirm=oui)", () => {
    expect(
      deleteStaffSchema.safeParse({ staffId: "stf-0001", confirm: "oui" })
        .success,
    ).toBe(true);
    expect(
      deleteStaffSchema.safeParse({ staffId: "stf-0001", confirm: "SUPPRIMER" })
        .success,
    ).toBe(false);
    expect(deleteStaffSchema.safeParse({ staffId: "stf-0001" }).success).toBe(
      false,
    );
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
