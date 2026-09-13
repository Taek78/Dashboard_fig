import { describe, expect, it } from "vitest";
import { parseMetricPeriod } from "@/domain/metrics/schemas";

describe("parseMetricPeriod", () => {
  it("accepte 7, 30, tout ; 30 par défaut ou si invalide", () => {
    expect(parseMetricPeriod({ periode: "7" })).toBe("7");
    expect(parseMetricPeriod({ periode: "tout" })).toBe("tout");
    expect(parseMetricPeriod({})).toBe("30");
    expect(parseMetricPeriod({ periode: "90" })).toBe("30");
    expect(parseMetricPeriod({ periode: ["7", "30"] })).toBe("30");
  });
});
