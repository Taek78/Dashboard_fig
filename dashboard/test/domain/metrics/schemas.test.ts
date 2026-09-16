import { describe, expect, it } from "vitest";
import { parseMetricsQuery, parsePeriodQuery } from "@/domain/metrics/schemas";

const NO_CUSTOM = { range: null, error: null };

describe("parseMetricsQuery", () => {
  it("défauts : ce mois-ci, pas de plage libre, HT", () => {
    expect(parseMetricsQuery({})).toEqual({
      period: "ce-mois",
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("lit la période, le mode TVA, et ignore l'invalide", () => {
    expect(parseMetricsQuery({ periode: "n-2", tva: "ttc" })).toEqual({
      period: "n-2",
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ttc",
      comparison: "n-1",
    });
    expect(parseMetricsQuery({ comparaison: "precedente" }).comparison).toBe(
      "precedente",
    );
    expect(parseMetricsQuery({ comparaison: "n-5" }).comparison).toBe("n-1");
    expect(parseMetricsQuery({ periode: "7", tva: "TTC" })).toEqual({
      period: "ce-mois",
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("plage libre : ordonnée appliquée, une date = ce jour-là, inversée refusée avec son erreur", () => {
    expect(
      parseMetricsQuery({ du: "2026-07-13", au: "2026-07-19" }).customRange,
    ).toEqual({
      from: "2026-07-13",
      to: "2026-07-19",
    });
    const inverted = parseMetricsQuery({ du: "2026-07-19", au: "2026-07-13" });
    expect(inverted.customRange).toBeNull();
    expect(inverted.custom).toEqual({
      from: "2026-07-19",
      to: "2026-07-13",
      range: null,
      error: "inverted",
    });
    expect(parseMetricsQuery({ du: "2026-07-13" }).customRange).toEqual({
      from: "2026-07-13",
      to: "2026-07-13",
    });
    expect(
      parseMetricsQuery({ du: "13/07/2026", au: "2026-07-19" }).customRange,
    ).toEqual({ from: "2026-07-19", to: "2026-07-19" });
  });
});

describe("parsePeriodQuery", () => {
  it("défaut : aujourd'hui en HT, ou la période passée en second argument", () => {
    expect(parsePeriodQuery({})).toEqual({
      period: "aujourdhui",
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
    });
    expect(parsePeriodQuery({ tva: "ttc" }).tax).toBe("ttc");
    expect(parsePeriodQuery({ tva: "x" }).tax).toBe("ht");
    expect(parsePeriodQuery({}, "ce-mois").period).toBe("ce-mois");
    expect(parsePeriodQuery({ periode: "hier" }).period).toBe("hier");
    expect(parsePeriodQuery({ periode: "7" }).period).toBe("aujourdhui");
  });

  it("lit une plage libre par la règle commune des périodes", () => {
    expect(
      parsePeriodQuery({ du: "2026-07-13", au: "2026-07-19" }).customRange,
    ).toEqual({ from: "2026-07-13", to: "2026-07-19" });
    const inverted = parsePeriodQuery({ du: "2026-07-19", au: "2026-07-13" });
    expect(inverted.customRange).toBeNull();
    expect(inverted.custom.error).toBe("inverted");
  });
});
