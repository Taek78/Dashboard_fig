import { describe, expect, it } from "vitest";
import {
  alertPrefsSchema,
  alertReadKindSchema,
  alertSince,
} from "@/domain/alerts/schemas";

const now = new Date("2026-09-18T12:00:00.000Z");

describe("alertSince (?depuis= du flux des alertes)", () => {
  it("absent ou illisible : la dernière minute", () => {
    expect(alertSince(null, now).toISOString()).toBe(
      "2026-09-18T11:59:00.000Z",
    );
    expect(alertSince("hier", now).toISOString()).toBe(
      "2026-09-18T11:59:00.000Z",
    );
  });

  it("une date valide est reprise, avec son fuseau", () => {
    expect(alertSince("2026-09-18T11:58:30.000Z", now).toISOString()).toBe(
      "2026-09-18T11:58:30.000Z",
    );
    expect(alertSince("2026-09-18T13:58:30+02:00", now).toISOString()).toBe(
      "2026-09-18T11:58:30.000Z",
    );
  });

  it("jamais plus de dix minutes en arrière, jamais dans le futur", () => {
    expect(alertSince("2020-01-01T00:00:00.000Z", now).toISOString()).toBe(
      "2026-09-18T11:50:00.000Z",
    );
    expect(alertSince("2030-01-01T00:00:00.000Z", now).toISOString()).toBe(
      now.toISOString(),
    );
  });
});

describe("alertPrefsSchema / alertReadKindSchema", () => {
  it("case cochée = activée, absente = désactivée", () => {
    expect(
      alertPrefsSchema.parse({ orders: "on", messages: "on", muted: "on" }),
    ).toEqual({ orders: true, messages: true, muted: true });
    expect(alertPrefsSchema.parse({ messages: "on" })).toEqual({
      orders: false,
      messages: true,
      muted: false,
    });
    expect(alertPrefsSchema.safeParse({ orders: "oui" }).success).toBe(false);
  });

  it("seuls les trois fils suivis", () => {
    expect(alertReadKindSchema.safeParse("stock").success).toBe(true);
    expect(alertReadKindSchema.safeParse("comptes").success).toBe(false);
  });
});
