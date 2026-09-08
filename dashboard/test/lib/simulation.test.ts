import { describe, expect, it } from "vitest";
import { readSimulationMode } from "@/lib/simulation";

describe("readSimulationMode", () => {
  it("est inerte hors développement, quelle que soit la valeur", () => {
    expect(readSimulationMode("vide", false)).toBeNull();
    expect(readSimulationMode("erreur", false)).toBeNull();
  });

  it.each(["vide", "erreur"] as const)(
    "lit le mode %s en développement",
    (mode) => {
      expect(readSimulationMode(mode, true)).toBe(mode);
    },
  );

  it("ignore un paramètre répété (tableau)", () => {
    expect(readSimulationMode(["vide", "erreur"], true)).toBeNull();
  });

  it.each(["plouf", "", undefined])("ignore la valeur %s", (raw) => {
    expect(readSimulationMode(raw, true)).toBeNull();
  });
});
