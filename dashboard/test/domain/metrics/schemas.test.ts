import { describe, expect, it } from "vitest";
import {
  parseMetricsQuery,
  parsePeriodQuery,
  periodParams,
} from "@/domain/metrics/schemas";

const NO_CUSTOM = { range: null, error: null };

describe("parseMetricsQuery", () => {
  it("défauts : ce mois-ci, zone de dates fermée, HT", () => {
    expect(parseMetricsQuery({})).toEqual({
      period: "ce-mois",
      customPeriod: false,
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("lit la période, le mode TVA, et ignore l'invalide", () => {
    expect(parseMetricsQuery({ periode: "n-2", tva: "ttc" })).toEqual({
      period: "n-2",
      customPeriod: false,
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
      customPeriod: false,
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("période personnalisée : la zone est ouverte, la plage ordonnée appliquée, une date = ce jour-là, inversée refusée avec son erreur", () => {
    const ordered = parseMetricsQuery({
      periode: "personnalisee",
      du: "2026-07-13",
      au: "2026-07-19",
    });
    expect(ordered.customPeriod).toBe(true);
    expect(ordered.period).toBe("ce-mois");
    expect(ordered.customRange).toEqual({
      from: "2026-07-13",
      to: "2026-07-19",
    });
    const inverted = parseMetricsQuery({
      periode: "personnalisee",
      du: "2026-07-19",
      au: "2026-07-13",
    });
    expect(inverted.customPeriod).toBe(true);
    expect(inverted.customRange).toBeNull();
    expect(inverted.custom).toEqual({
      from: "2026-07-19",
      to: "2026-07-13",
      range: null,
      error: "inverted",
    });
    expect(
      parseMetricsQuery({ periode: "personnalisee", du: "2026-07-13" })
        .customRange,
    ).toEqual({ from: "2026-07-13", to: "2026-07-13" });
    expect(
      parseMetricsQuery({
        periode: "personnalisee",
        du: "13/07/2026",
        au: "2026-07-19",
      }).customRange,
    ).toEqual({ from: "2026-07-19", to: "2026-07-19" });
  });

  it("« personnalisée » sans date : zone ouverte, aucune plage, la période par défaut reste affichée", () => {
    expect(parseMetricsQuery({ periode: "personnalisee" })).toEqual({
      period: "ce-mois",
      customPeriod: true,
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
      comparison: "n-1",
    });
    expect(
      parseMetricsQuery({ periode: "personnalisee", du: "", au: "" })
        .customPeriod,
    ).toBe(true);
  });

  it("des dates dans l'URL ouvrent la zone même sans ?periode=personnalisee (anciens liens), la période prédéfinie restant celle de l'URL", () => {
    const legacy = parseMetricsQuery({ du: "2026-07-13", au: "2026-07-19" });
    expect(legacy.customPeriod).toBe(true);
    expect(legacy.customRange).toEqual({
      from: "2026-07-13",
      to: "2026-07-19",
    });
    const withPeriod = parseMetricsQuery({
      periode: "hier",
      du: "2026-07-19",
      au: "2026-07-13",
    });
    expect(withPeriod.customPeriod).toBe(true);
    expect(withPeriod.period).toBe("hier");
    expect(withPeriod.custom.error).toBe("inverted");
  });
});

describe("parsePeriodQuery", () => {
  it("défaut : aujourd'hui en HT, ou la période passée en second argument", () => {
    expect(parsePeriodQuery({})).toEqual({
      period: "aujourdhui",
      customPeriod: false,
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
    });
    expect(parsePeriodQuery({ tva: "ttc" }).tax).toBe("ttc");
    expect(parsePeriodQuery({ tva: "x" }).tax).toBe("ht");
    expect(parsePeriodQuery({}, "ce-mois").period).toBe("ce-mois");
    expect(parsePeriodQuery({ periode: "hier" }).period).toBe("hier");
    expect(parsePeriodQuery({ periode: "7" }).period).toBe("aujourdhui");
    expect(parsePeriodQuery({ periode: "personnalisee" })).toEqual({
      period: "aujourdhui",
      customPeriod: true,
      customRange: null,
      custom: NO_CUSTOM,
      tax: "ht",
    });
  });

  it("lit la période personnalisée par la règle commune des dates", () => {
    expect(
      parsePeriodQuery({ du: "2026-07-13", au: "2026-07-19" }).customRange,
    ).toEqual({ from: "2026-07-13", to: "2026-07-19" });
    const inverted = parsePeriodQuery({ du: "2026-07-19", au: "2026-07-13" });
    expect(inverted.customPeriod).toBe(true);
    expect(inverted.customRange).toBeNull();
    expect(inverted.custom.error).toBe("inverted");
  });
});

describe("periodParams", () => {
  it("rejoue une période prédéfinie", () => {
    expect(periodParams(parsePeriodQuery({ periode: "hier" }))).toBe(
      "periode=hier",
    );
    expect(periodParams(parseMetricsQuery({}))).toBe("periode=ce-mois");
  });

  it("rejoue la période personnalisée avec les dates telles que saisies, même inversées ou absentes", () => {
    expect(
      periodParams(
        parsePeriodQuery({
          periode: "personnalisee",
          du: "2026-07-13",
          au: "2026-07-19",
        }),
      ),
    ).toBe("periode=personnalisee&du=2026-07-13&au=2026-07-19");
    expect(
      periodParams(parsePeriodQuery({ du: "2026-07-19", au: "2026-07-13" })),
    ).toBe("periode=personnalisee&du=2026-07-19&au=2026-07-13");
    expect(periodParams(parsePeriodQuery({ au: "2026-07-13" }))).toBe(
      "periode=personnalisee&au=2026-07-13",
    );
    expect(periodParams(parsePeriodQuery({ periode: "personnalisee" }))).toBe(
      "periode=personnalisee",
    );
  });
});
