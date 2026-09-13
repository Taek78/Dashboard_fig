import { describe, expect, it } from "vitest";
import { parseMetricsQuery, parsePeriodQuery } from "@/domain/metrics/schemas";

describe("parseMetricsQuery", () => {
  it("défauts : ce mois-ci, pas de plage libre, HT", () => {
    expect(parseMetricsQuery({})).toEqual({
      period: "ce-mois",
      customRange: null,
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("lit la période, le mode TVA, et ignore l'invalide", () => {
    expect(parseMetricsQuery({ periode: "n-2", tva: "ttc" })).toEqual({
      period: "n-2",
      customRange: null,
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
      tax: "ht",
      comparison: "n-1",
    });
  });

  it("accepte une plage libre ordonnée, la refuse sinon", () => {
    expect(
      parseMetricsQuery({ du: "2026-07-13", au: "2026-07-19" }).customRange,
    ).toEqual({
      from: "2026-07-13",
      to: "2026-07-19",
    });
    expect(
      parseMetricsQuery({ du: "2026-07-19", au: "2026-07-13" }).customRange,
    ).toBeNull();
    expect(parseMetricsQuery({ du: "2026-07-13" }).customRange).toBeNull();
    expect(
      parseMetricsQuery({ du: "13/07/2026", au: "2026-07-19" }).customRange,
    ).toBeNull();
  });
});

describe("parsePeriodQuery", () => {
  it("défaut : aujourd'hui en HT, ou la période passée en second argument", () => {
    expect(parsePeriodQuery({})).toEqual({
      period: "aujourdhui",
      customRange: null,
      tax: "ht",
    });
    expect(parsePeriodQuery({ tva: "ttc" }).tax).toBe("ttc");
    expect(parsePeriodQuery({ tva: "x" }).tax).toBe("ht");
    expect(parsePeriodQuery({}, "ce-mois").period).toBe("ce-mois");
    expect(parsePeriodQuery({ periode: "hier" }).period).toBe("hier");
    expect(parsePeriodQuery({ periode: "7" }).period).toBe("aujourdhui");
  });

  it("lit une plage libre ordonnée seulement", () => {
    expect(
      parsePeriodQuery({ du: "2026-07-13", au: "2026-07-19" }).customRange,
    ).toEqual({ from: "2026-07-13", to: "2026-07-19" });
    expect(
      parsePeriodQuery({ du: "2026-07-19", au: "2026-07-13" }).customRange,
    ).toBeNull();
  });
});
