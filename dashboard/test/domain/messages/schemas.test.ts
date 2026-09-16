import { describe, expect, it } from "vitest";
import {
  parseMessageFilters,
  setMessageImportantSchema,
  setMessagePinnedSchema,
  setMessageStatusSchema,
} from "@/domain/messages/schemas";

describe("parseMessageFilters (lecture tolérante)", () => {
  it("traduit les clés françaises de l'URL en filtres", () => {
    expect(
      parseMessageFilters({
        q: "  amel  ",
        statut: "treated",
        objet: "refund",
        du: "2026-09-01",
        au: "2026-09-08",
        important: "oui",
      }),
    ).toEqual({
      query: "amel",
      status: "treated",
      subject: "refund",
      from: "2026-09-01",
      to: "2026-09-08",
      important: true,
    });
  });

  it("ignore toute valeur invalide au lieu d'échouer", () => {
    expect(
      parseMessageFilters({
        q: "x".repeat(500),
        statut: "n'importe quoi",
        objet: "inconnu",
        du: "2026-13-45",
        au: "hier",
        important: "non",
        page: "2",
        inconnu: "valeur",
      }),
    ).toEqual({
      query: undefined,
      status: undefined,
      subject: undefined,
      from: undefined,
      to: undefined,
      important: undefined,
    });
  });

  it("une recherche vide ne filtre pas, un paramètre répété est ignoré", () => {
    expect(parseMessageFilters({ q: "   " }).query).toBeUndefined();
    expect(
      parseMessageFilters({ statut: ["treated", "untreated"] }).status,
    ).toBeUndefined();
  });

  it("remet les bornes de période dans l'ordre si elles sont inversées", () => {
    const filters = parseMessageFilters({ du: "2026-09-08", au: "2026-09-01" });
    expect(filters.from).toBe("2026-09-01");
    expect(filters.to).toBe("2026-09-08");
  });

  it("seule la valeur « oui » active le filtre des importants", () => {
    expect(parseMessageFilters({ important: "oui" }).important).toBe(true);
    expect(
      parseMessageFilters({ important: "true" }).important,
    ).toBeUndefined();
    expect(parseMessageFilters({}).important).toBeUndefined();
  });
});

describe("schémas d'écriture (stricts)", () => {
  it("le statut visé doit être un statut connu", () => {
    expect(
      setMessageStatusSchema.safeParse({
        messageId: "msg-0001",
        nextStatus: "treated",
      }).success,
    ).toBe(true);
    for (const nextStatus of ["", "archive", "TREATED"]) {
      expect(
        setMessageStatusSchema.safeParse({ messageId: "msg-0001", nextStatus })
          .success,
      ).toBe(false);
    }
    expect(
      setMessageStatusSchema.safeParse({ messageId: "", nextStatus: "treated" })
        .success,
    ).toBe(false);
  });

  it("les bascules convertissent « oui » / « non » en booléen et refusent le reste", () => {
    expect(
      setMessagePinnedSchema.parse({ messageId: "msg-0001", pinned: "oui" }),
    ).toEqual({ messageId: "msg-0001", pinned: true });
    expect(
      setMessageImportantSchema.parse({
        messageId: "msg-0001",
        important: "non",
      }),
    ).toEqual({ messageId: "msg-0001", important: false });

    for (const value of ["", "true", "1", undefined]) {
      expect(
        setMessagePinnedSchema.safeParse({
          messageId: "msg-0001",
          pinned: value,
        }).success,
      ).toBe(false);
    }
  });
});
