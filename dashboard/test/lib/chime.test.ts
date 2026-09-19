import { describe, expect, it } from "vitest";
import {
  chimeDuration,
  MESSAGE_CHIME,
  ORDER_CHIME,
  playMessageChime,
  playOrderChime,
} from "@/lib/chime";

describe("signatures sonores", () => {
  it("commande : trois notes qui montent, jouées trois fois d'affilée, un peu plus de deux secondes", () => {
    expect(ORDER_CHIME.notesHz).toEqual(
      [...ORDER_CHIME.notesHz].toSorted((a, b) => a - b),
    );
    expect(ORDER_CHIME.notesHz).toHaveLength(3);
    expect(ORDER_CHIME.repeats).toBe(3);
    expect(chimeDuration(ORDER_CHIME)).toBeGreaterThanOrEqual(2);
    expect(chimeDuration(ORDER_CHIME)).toBeLessThan(2.5);
  });

  it("message : son propre, deux notes qui descendent, deux fois d'affilée, plus court et plus doux", () => {
    expect(MESSAGE_CHIME.notesHz).toEqual(
      [...MESSAGE_CHIME.notesHz].toSorted((a, b) => b - a),
    );
    expect(MESSAGE_CHIME.notesHz).not.toEqual(ORDER_CHIME.notesHz);
    expect(MESSAGE_CHIME.repeats).toBe(2);
    // Les deux passages ne se chevauchent pas : on entend bien deux fois.
    expect(MESSAGE_CHIME.repeatGapS).toBeGreaterThan(
      (MESSAGE_CHIME.notesHz.length - 1) * MESSAGE_CHIME.noteGapS +
        MESSAGE_CHIME.noteLengthS,
    );
    expect(chimeDuration(MESSAGE_CHIME)).toBeLessThan(
      chimeDuration(ORDER_CHIME),
    );
    expect(MESSAGE_CHIME.peakGain).toBeLessThan(ORDER_CHIME.peakGain);
  });

  it("sans geste de la personne (contexte audio absent), ne fait rien et ne lève pas", () => {
    expect(() => playOrderChime()).not.toThrow();
    expect(() => playMessageChime()).not.toThrow();
  });
});
