import { describe, expect, it } from "vitest";
import {
  NOTE_MAX_LENGTH,
  addNoteSchema,
  parseClientsSearch,
  parseCustomerHistoryPeriod,
} from "@/domain/customers/schemas";

describe("parseCustomerHistoryPeriod", () => {
  it("lit les deux bornes, ou une seule", () => {
    expect(
      parseCustomerHistoryPeriod({ du: "2026-09-05", au: "2026-09-09" }),
    ).toEqual({ from: "2026-09-05", to: "2026-09-09" });
    expect(parseCustomerHistoryPeriod({ du: "2026-09-05" })).toEqual({
      from: "2026-09-05",
      to: undefined,
    });
    expect(parseCustomerHistoryPeriod({ au: "2026-09-09" })).toEqual({
      from: undefined,
      to: "2026-09-09",
    });
  });

  it("remet dans l'ordre des bornes inversées", () => {
    expect(
      parseCustomerHistoryPeriod({ du: "2026-09-09", au: "2026-09-05" }),
    ).toEqual({ from: "2026-09-05", to: "2026-09-09" });
  });

  it("ignore les dates invalides, répétées et les autres clés", () => {
    const none = { from: undefined, to: undefined };
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
  it("lit recherche, type, tri et page", () => {
    expect(
      parseClientsSearch({
        q: " amel ",
        type: "communautes",
        tri: "recent",
        page: "2",
      }),
    ).toEqual({ query: "amel", type: "communautes", sort: "recent", page: 2 });
  });

  it("par défaut : tout le monde, par nom, première page", () => {
    expect(parseClientsSearch({})).toEqual({
      query: undefined,
      type: "tous",
      sort: "nom",
      page: 1,
    });
    expect(parseClientsSearch({ q: "" }).query).toBeUndefined();
    expect(parseClientsSearch({ q: ["a", "b"] }).query).toBeUndefined();
    expect(parseClientsSearch({ q: "x".repeat(65) }).query).toBeUndefined();
    expect(parseClientsSearch({ type: "autre" }).type).toBe("tous");
    expect(parseClientsSearch({ tri: "prix" }).sort).toBe("nom");
    expect(parseClientsSearch({ page: "0" }).page).toBe(1);
    expect(parseClientsSearch({ page: "-3" }).page).toBe(1);
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
