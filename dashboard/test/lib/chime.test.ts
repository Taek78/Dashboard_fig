import { describe, expect, it } from "vitest";
import {
  CHIME_DURATION_S,
  CHIME_NOTES_HZ,
  CHIME_REPEATS,
  playChime,
} from "@/lib/chime";

describe("carillon d'une nouvelle commande", () => {
  it("un arpège montant joué deux fois, environ deux secondes", () => {
    expect(CHIME_NOTES_HZ).toEqual(
      [...CHIME_NOTES_HZ].toSorted((a, b) => a - b),
    );
    expect(CHIME_REPEATS).toBe(2);
    expect(CHIME_DURATION_S).toBeGreaterThanOrEqual(2);
    expect(CHIME_DURATION_S).toBeLessThan(3);
  });

  it("sans geste de la personne (contexte audio absent), ne fait rien et ne lève pas", () => {
    expect(() => playChime()).not.toThrow();
  });
});
