import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "@/lib/days";

describe("addDays / daysBetween", () => {
  it("traverse fins de mois et d'année, en jours civils", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    // Passage à l'heure d'été le 29 mars 2026 : sans effet en UTC.
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("compte les jours bornes incluses", () => {
    expect(daysBetween({ from: "2026-09-08", to: "2026-09-08" })).toBe(1);
    expect(daysBetween({ from: "2026-09-01", to: "2026-09-07" })).toBe(7);
  });
});
