import { describe, expect, it } from "vitest";
import { parseMetricsQuery } from "@/domain/metrics/schemas";

describe("parseMetricsQuery", () => {
  it("défauts : ce mois-ci, pas de plage libre, TTC", () => {
    expect(parseMetricsQuery({})).toEqual({
      period: "ce-mois",
      customRange: null,
      tax: "ttc",
      comparison: "n-1",
    });
  });

  it("lit la période, le mode TVA, et ignore l'invalide", () => {
    expect(parseMetricsQuery({ periode: "n-2", tva: "ht" })).toEqual({
      period: "n-2",
      customRange: null,
      tax: "ht",
      comparison: "n-1",
    });
    expect(parseMetricsQuery({ comparaison: "precedente" }).comparison).toBe(
      "precedente",
    );
    expect(parseMetricsQuery({ comparaison: "n-5" }).comparison).toBe("n-1");
    expect(parseMetricsQuery({ periode: "7", tva: "HT" })).toEqual({
      period: "ce-mois",
      customRange: null,
      tax: "ttc",
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
