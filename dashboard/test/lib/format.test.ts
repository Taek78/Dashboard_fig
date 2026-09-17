import { describe, expect, it } from "vitest";
import {
  endSentence,
  formatDateFr,
  formatDateTimeFr,
  formatDayLongFr,
  formatEuros,
  formatOrdersCount,
  formatPeriodFr,
  formatQuantity,
  formatSlot,
  toTelHref,
} from "@/lib/format";

describe("endSentence", () => {
  it("ajoute un point, sauf après une abréviation qui en porte déjà un", () => {
    expect(endSentence("Aucune commande livrée du 2 au 3 mars")).toBe(
      "Aucune commande livrée du 2 au 3 mars.",
    );
    expect(endSentence("livrée le lun. 7 sept.")).toBe(
      "livrée le lun. 7 sept.",
    );
    expect(
      endSentence(
        `Aucune commande livrée ${formatPeriodFr("2026-09-05", "2026-09-09")}`,
      ),
    ).not.toMatch(/\.\.$/);
  });
});

describe("formatPeriodFr", () => {
  it("deux bornes, un seul jour, une borne ou aucune", () => {
    expect(plain(formatPeriodFr("2026-09-05", "2026-09-09"))).toBe(
      "du sam. 5 sept. au mer. 9 sept. 2026",
    );
    // Deux années : chaque borne porte la sienne.
    expect(plain(formatPeriodFr("2025-12-30", "2026-01-02"))).toBe(
      "du mar. 30 déc. 2025 au ven. 2 janv. 2026",
    );
    expect(plain(formatPeriodFr("2026-09-07", "2026-09-07"))).toBe(
      "le lun. 7 sept. 2026",
    );
    expect(plain(formatPeriodFr("2026-09-05"))).toBe(
      "depuis le sam. 5 sept. 2026",
    );
    expect(plain(formatPeriodFr(undefined, "2026-09-09"))).toBe(
      "jusqu'au mer. 9 sept. 2026",
    );
    expect(formatPeriodFr()).toBe("");
  });
});

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
  it("formate une date ISO courte en jour abrégé, numéro, mois et année", () => {
    expect(plain(formatDateFr("2026-09-08"))).toBe("mar. 8 sept. 2026");
  });

  it("ne glisse pas d'un jour selon le fuseau (minuit UTC reste le bon jour)", () => {
    expect(plain(formatDateFr("2026-09-07T00:00:00.000Z"))).toBe(
      "lun. 7 sept. 2026",
    );
  });

  it("accepte un ISO complet avec heure", () => {
    expect(plain(formatDateFr("2026-09-06T23:30:00.000Z"))).toBe(
      "lun. 7 sept. 2026",
    );
  });
});

describe("formatSlot", () => {
  it("assemble la date et le créneau avec un tiret demi-cadratin", () => {
    expect(
      plain(formatSlot({ date: "2026-09-08", start: "09:00", end: "11:00" })),
    ).toBe("mar. 8 sept. 2026, 09:00–11:00");
  });
});

const NBSP = "\u00A0";

describe("formatQuantity", () => {
  it("affiche les grammes tels quels sous 1000", () => {
    expect(formatQuantity(500, "g")).toBe(`500${NBSP}g`);
    expect(formatQuantity(999, "g")).toBe(`999${NBSP}g`);
  });

  it("passe en kilos à partir de 1000 g, sans décimale inutile", () => {
    expect(formatQuantity(1000, "g")).toBe(`1${NBSP}kg`);
    expect(formatQuantity(1500, "g")).toBe(`1,5${NBSP}kg`);
    expect(formatQuantity(1250, "g")).toBe(`1,25${NBSP}kg`);
  });

  it("accorde « pièce » au pluriel seulement au-delà de 1", () => {
    expect(formatQuantity(0, "piece")).toBe(`0${NBSP}pièce`);
    expect(formatQuantity(1, "piece")).toBe(`1${NBSP}pièce`);
    expect(formatQuantity(3, "piece")).toBe(`3${NBSP}pièces`);
  });

  it("utilise un espace insécable, jamais un espace simple", () => {
    expect(formatQuantity(3, "piece")).not.toContain(" ");
    expect(formatQuantity(1500, "g")).not.toContain(" ");
  });
});

describe("formatOrdersCount", () => {
  it("accorde « commande » selon le nombre", () => {
    expect(formatOrdersCount(0)).toBe(`0${NBSP}commande`);
    expect(formatOrdersCount(1)).toBe(`1${NBSP}commande`);
    expect(formatOrdersCount(14)).toBe(`14${NBSP}commandes`);
  });
});

describe("toTelHref", () => {
  it("retire les espaces et remplace le 0 initial par +33", () => {
    expect(toTelHref("06 39 98 00 01")).toBe("tel:+33639980001");
  });

  it("laisse un numéro déjà international tel quel", () => {
    expect(toTelHref("+33 6 39 98 00 01")).toBe("tel:+33639980001");
  });
});

describe("formatDateTimeFr", () => {
  it("donne le jour et l'heure de Paris (UTC+2 en septembre)", () => {
    expect(plain(formatDateTimeFr("2026-09-07T08:15:00.000Z"))).toBe(
      "lun. 7 sept. 2026, 10:15",
    );
  });
});

describe("formatDayLongFr", () => {
  it("écrit le jour en toutes lettres, sans décalage de fuseau", () => {
    expect(plain(formatDayLongFr("2026-09-07"))).toBe("lundi 7 septembre 2026");
    expect(plain(formatDayLongFr("2026-01-01"))).toBe("jeudi 1 janvier 2026");
  });
});
