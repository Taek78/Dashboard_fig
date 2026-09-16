import { describe, expect, it } from "vitest";
import {
  CALENDAR_WEEKS,
  daysInMonth,
  initialFocusDay,
  isIsoDay,
  monthGrid,
  monthOf,
  moveFocusDay,
  openingMonth,
  shiftDayByMonths,
  shiftMonth,
  weekdayIndex,
} from "@/lib/calendar";

describe("jours et mois", () => {
  it("reconnaît un jour qui existe", () => {
    expect(isIsoDay("2026-09-16")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2026-04-31")).toBe(false);
    expect(isIsoDay("16/09/2026")).toBe(false);
    expect(isIsoDay("")).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });

  it("décale les mois en passant les années, compte leurs jours", () => {
    expect(monthOf("2026-09-16")).toBe("2026-09");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", -12)).toBe("2025-09");
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-09")).toBe(30);
    expect(shiftDayByMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDayByMonths("2026-03-15", -1)).toBe("2026-02-15");
  });

  it("numérote la semaine du lundi (0) au dimanche (6)", () => {
    expect(weekdayIndex("2026-09-14")).toBe(0); // lundi
    expect(weekdayIndex("2026-09-20")).toBe(6); // dimanche
  });
});

describe("monthGrid", () => {
  it("six semaines du lundi au dimanche, les jours voisins hors du mois", () => {
    const grid = monthGrid("2026-09");
    expect(grid).toHaveLength(CALENDAR_WEEKS);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // Le 1er septembre 2026 est un mardi : la grille part du lundi 31 août.
    expect(grid[0]![0]).toEqual({ day: "2026-08-31", inMonth: false });
    expect(grid[0]![1]).toEqual({ day: "2026-09-01", inMonth: true });
    const days = grid.flat();
    expect(days.filter((d) => d.inMonth)).toHaveLength(30);
    expect(days.at(-1)).toEqual({ day: "2026-10-11", inMonth: false });
    expect(days.every((d) => weekdayIndex(d.day) === days.indexOf(d) % 7)).toBe(
      true,
    );
  });

  it("un mois qui commence un lundi n'a pas de jour voisin en tête", () => {
    expect(monthGrid("2026-06")[0]![0]).toEqual({
      day: "2026-06-01",
      inMonth: true,
    });
  });
});

describe("openingMonth / initialFocusDay", () => {
  const today = "2026-09-16";

  it("s'ouvre sur la date saisie, sinon l'autre borne, sinon aujourd'hui", () => {
    expect(openingMonth("2026-03-04", "2026-05-01", today)).toBe("2026-03");
    expect(openingMonth("", "2026-05-01", today)).toBe("2026-05");
    expect(openingMonth(undefined, "", today)).toBe("2026-09");
    expect(openingMonth("2026-02-30", null, today)).toBe("2026-09");
  });

  it("met le focus sur la date saisie, sinon aujourd'hui, sinon le 1er", () => {
    expect(initialFocusDay("2026-03", "2026-03-04", today)).toBe("2026-03-04");
    expect(initialFocusDay("2026-09", "", today)).toBe("2026-09-16");
    expect(initialFocusDay("2026-05", "", today)).toBe("2026-05-01");
    expect(initialFocusDay("2026-05", "2026-03-04", today)).toBe("2026-05-01");
  });
});

describe("moveFocusDay", () => {
  it("flèches, début et fin de semaine, mois et années", () => {
    const day = "2026-09-16"; // mercredi
    expect(moveFocusDay(day, "ArrowLeft")).toBe("2026-09-15");
    expect(moveFocusDay(day, "ArrowRight")).toBe("2026-09-17");
    expect(moveFocusDay(day, "ArrowUp")).toBe("2026-09-09");
    expect(moveFocusDay(day, "ArrowDown")).toBe("2026-09-23");
    expect(moveFocusDay(day, "Home")).toBe("2026-09-14");
    expect(moveFocusDay(day, "End")).toBe("2026-09-20");
    expect(moveFocusDay(day, "PageUp")).toBe("2026-08-16");
    expect(moveFocusDay(day, "PageDown")).toBe("2026-10-16");
    expect(moveFocusDay(day, "PageDown", true)).toBe("2027-09-16");
    expect(moveFocusDay("2026-10-31", "PageUp")).toBe("2026-09-30");
    expect(moveFocusDay(day, "a")).toBeNull();
  });
});
