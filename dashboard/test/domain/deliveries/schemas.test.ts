import { describe, expect, it } from "vitest";
import { parseTourDate } from "@/domain/deliveries/schemas";

describe("parseTourDate", () => {
  it("renvoie la date valide, undefined sinon", () => {
    expect(parseTourDate({ date: "2026-09-07" })).toBe("2026-09-07");
    expect(parseTourDate({})).toBeUndefined();
    expect(parseTourDate({ date: "07/09/2026" })).toBeUndefined();
    expect(
      parseTourDate({ date: ["2026-09-07", "2026-09-08"] }),
    ).toBeUndefined();
  });
});
