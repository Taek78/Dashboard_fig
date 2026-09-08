import { describe, expect, it } from "vitest";
import { formatDateFr, formatEuros, formatSlot } from "@/lib/format";

/* Intl insère des espaces insécables (U+202F, U+00A0) : on les normalise avant de comparer. */
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatEuros", () => {
  it.each([
    [2490, "24,90 €"],
    [0, "0,00 €"],
    [5, "0,05 €"],
    [123456, "1 234,56 €"],
  ])("%i centimes → %s", (cents, expected) => {
    expect(plain(formatEuros(cents))).toBe(expected);
  });
});

describe("formatDateFr", () => {
  it("formate une date ISO courte en jour abrégé, numéro et mois", () => {
    expect(plain(formatDateFr("2026-09-08"))).toBe("mar. 8 sept.");
  });

  it("ne glisse pas d'un jour selon le fuseau (minuit UTC reste le bon jour)", () => {
    expect(plain(formatDateFr("2026-09-07T00:00:00.000Z"))).toBe(
      "lun. 7 sept.",
    );
  });

  it("accepte un ISO complet avec heure", () => {
    expect(plain(formatDateFr("2026-09-06T23:30:00.000Z"))).toBe(
      "lun. 7 sept.",
    );
  });
});

describe("formatSlot", () => {
  it("assemble la date et le créneau avec un tiret demi-cadratin", () => {
    expect(
      plain(formatSlot({ date: "2026-09-08", start: "09:00", end: "11:00" })),
    ).toBe("mar. 8 sept., 09:00–11:00");
  });
});
