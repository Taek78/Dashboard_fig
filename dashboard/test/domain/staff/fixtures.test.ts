import { describe, expect, it } from "vitest";
import { STAFF_KINDS, WEEKDAYS } from "@/domain/staff/kind";
import { staffFixtures } from "@/domain/staff/fixtures";

describe("staffFixtures", () => {
  it("couvre les trois métiers, avec une personne partie pour l'historique", () => {
    for (const kind of STAFF_KINDS) {
      expect(staffFixtures.some((m) => m.kind === kind && m.active)).toBe(true);
    }
    expect(staffFixtures.some((m) => !m.active)).toBe(true);
  });

  it("ids et e-mails uniques, aucune personne réelle, jours valides et ordonnés", () => {
    expect(new Set(staffFixtures.map((m) => m.id)).size).toBe(
      staffFixtures.length,
    );
    expect(new Set(staffFixtures.map((m) => m.email.toLowerCase())).size).toBe(
      staffFixtures.length,
    );
    for (const m of staffFixtures) {
      expect(m.email).toMatch(/@fig-demo\.invalid$/);
      expect(m.phone).toMatch(/^06 39 98 90 \d{2}$/);
      expect(m.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const indexes = m.workDays.map((d) => WEEKDAYS.indexOf(d));
      expect(indexes.every((i) => i >= 0)).toBe(true);
      expect(indexes).toEqual([...indexes].toSorted((a, b) => a - b));
    }
  });
});
