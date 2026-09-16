import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween } from "@/lib/days";

describe("addMonths", () => {
  it("décale de mois civils en UTC, jour ramené au dernier du mois comme PostgreSQL", () => {
    expect(addMonths("2026-01-08T10:00:00.000Z", 2)).toBe(
      "2026-03-08T10:00:00.000Z",
    );
    expect(addMonths("2026-12-31T08:00:00.000Z", 2)).toBe(
      "2027-02-28T08:00:00.000Z",
    );
    expect(addMonths("2026-01-31T08:00:00.000Z", 1)).toBe(
      "2026-02-28T08:00:00.000Z",
    );
    expect(addMonths("2026-03-31T08:00:00.000Z", -1)).toBe(
      "2026-02-28T08:00:00.000Z",
    );
    expect(addMonths("2026-11-30T23:59:59.000Z", 3)).toBe(
      "2027-02-28T23:59:59.000Z",
    );
  });
});

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
