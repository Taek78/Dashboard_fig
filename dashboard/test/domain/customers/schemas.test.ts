import { describe, expect, it } from "vitest";
import {
  NOTE_MAX_LENGTH,
  addNoteSchema,
  parseClientsSearch,
  parseCustomerHistoryPeriod,
} from "@/domain/customers/schemas";

describe("parseCustomerHistoryPeriod", () => {
  it("lit les deux bornes ; une seule borne = ce jour-là", () => {
    expect(
      parseCustomerHistoryPeriod({ du: "2026-09-05", au: "2026-09-09" }),
    ).toEqual({
      filters: { from: "2026-09-05", to: "2026-09-09" },
      period: {
        from: "2026-09-05",
        to: "2026-09-09",
        range: { from: "2026-09-05", to: "2026-09-09" },
        error: null,
      },
    });
    expect(parseCustomerHistoryPeriod({ du: "2026-09-05" }).filters).toEqual({
      from: "2026-09-05",
      to: "2026-09-05",
    });
    expect(parseCustomerHistoryPeriod({ au: "2026-09-09" }).filters).toEqual({
      from: "2026-09-09",
      to: "2026-09-09",
    });
  });

  it("des bornes inversées ne filtrent rien et portent l'erreur pour l'écran", () => {
    const result = parseCustomerHistoryPeriod({
      du: "2026-09-09",
      au: "2026-09-05",
    });
    expect(result.filters).toEqual({ from: undefined, to: undefined });
    expect(result.period.error).toBe("inverted");
    expect(result.period.from).toBe("2026-09-09");
  });

  it("ignore les dates invalides, répétées et les autres clés", () => {
    const none = {
      filters: { from: undefined, to: undefined },
      period: { range: null, error: null },
    };
    expect(parseCustomerHistoryPeriod({})).toEqual(none);
    expect(parseCustomerHistoryPeriod({ du: "", au: "hier" })).toEqual(none);
    expect(parseCustomerHistoryPeriod({ du: "2026-02-30" })).toEqual(none);
    expect(
      parseCustomerHistoryPeriod({ du: ["2026-09-05", "2026-09-06"] }),
    ).toEqual(none);
    expect(
      parseCustomerHistoryPeriod({ q: "benali", statut: "delivered" }),
    ).toEqual(none);
  });
});

describe("parseClientsSearch", () => {
  it("lit recherche, type, tri (avec ou sans sens) et page", () => {
    expect(
      parseClientsSearch({
        q: " amel ",
        type: "communautes",
        tri: "recent",
        page: "2",
      }),
    ).toEqual({
      query: "amel",
      type: "communautes",
      sort: "recent",
      order: "decroissant",
      page: 2,
    });
    expect(parseClientsSearch({ tri: "montant-croissant" })).toMatchObject({
      sort: "montant",
      order: "croissant",
    });
    expect(parseClientsSearch({ tri: "nom-decroissant" })).toMatchObject({
      sort: "nom",
      order: "decroissant",
    });
  });

  it("par défaut : tout le monde, par nom croissant, première page", () => {
    expect(parseClientsSearch({})).toEqual({
      query: undefined,
      type: "tous",
      sort: "nom",
      order: "croissant",
      page: 1,
    });
    expect(parseClientsSearch({ q: "" }).query).toBeUndefined();
    expect(parseClientsSearch({ q: ["a", "b"] }).query).toBeUndefined();
    expect(parseClientsSearch({ q: "x".repeat(65) }).query).toBeUndefined();
    expect(parseClientsSearch({ type: "autre" }).type).toBe("tous");
    expect(parseClientsSearch({ tri: "prix" }).sort).toBe("nom");
    expect(parseClientsSearch({ tri: "nom-aleatoire" })).toMatchObject({
      sort: "nom",
      order: "croissant",
    });
    expect(parseClientsSearch({ page: "0" }).page).toBe(1);
    expect(parseClientsSearch({ page: "-3" }).page).toBe(1);
  });

  it("le tri par membres n'existe que pour les communautés", () => {
    expect(
      parseClientsSearch({ type: "communautes", tri: "membres" }),
    ).toMatchObject({ sort: "membres", order: "decroissant" });
    expect(
      parseClientsSearch({ type: "communautes", tri: "membres-croissant" }),
    ).toMatchObject({ sort: "membres", order: "croissant" });
    expect(parseClientsSearch({ tri: "membres" })).toMatchObject({
      sort: "nom",
      order: "croissant",
    });
    expect(
      parseClientsSearch({ type: "particuliers", tri: "membres" }).sort,
    ).toBe("nom");
  });
});

describe("addNoteSchema", () => {
  it("accepte une note trimée entre 1 et 500 caractères", () => {
    const r = addNoteSchema.safeParse({
      customerId: "cli-0001",
      text: "  Bonjour  ",
    });
    expect(r.success && r.data.text).toBe("Bonjour");
    expect(
      addNoteSchema.safeParse({
        customerId: "cli-0001",
        text: "x".repeat(NOTE_MAX_LENGTH),
      }).success,
    ).toBe(true);
  });

  it("refuse le vide, les espaces et le trop long", () => {
    expect(
      addNoteSchema.safeParse({ customerId: "cli-0001", text: "   " }).success,
    ).toBe(false);
    expect(
      addNoteSchema.safeParse({
        customerId: "cli-0001",
        text: "x".repeat(NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(addNoteSchema.safeParse({ text: "ok" }).success).toBe(false);
  });
});
