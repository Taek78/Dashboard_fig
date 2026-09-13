import { describe, expect, it } from "vitest";
import {
  NOTE_MAX_LENGTH,
  addNoteSchema,
  parseCustomerSearch,
} from "@/domain/customers/schemas";

describe("parseCustomerSearch", () => {
  it("renvoie la requête trimée et le drapeau « tous »", () => {
    expect(parseCustomerSearch({ q: " amel " })).toEqual({
      query: "amel",
      all: false,
    });
    expect(parseCustomerSearch({ tous: "1" })).toEqual({
      query: undefined,
      all: true,
    });
  });

  it("sans paramètre valide, ni requête ni liste : la page reste sur le moteur", () => {
    expect(parseCustomerSearch({})).toEqual({ query: undefined, all: false });
    expect(parseCustomerSearch({ q: "" }).query).toBeUndefined();
    expect(parseCustomerSearch({ q: ["a", "b"] }).query).toBeUndefined();
    expect(parseCustomerSearch({ q: "x".repeat(65) }).query).toBeUndefined();
    expect(parseCustomerSearch({ tous: "oui" }).all).toBe(false);
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
