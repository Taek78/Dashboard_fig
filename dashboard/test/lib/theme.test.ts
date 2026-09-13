import { describe, expect, it } from "vitest";
import {
  isTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
} from "@/lib/theme";

describe("resolveTheme", () => {
  it("garde un choix mémorisé valide", () => {
    expect(resolveTheme("fig", false)).toBe("fig");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("suit le système quand rien n'est mémorisé ou que la valeur est inconnue", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(undefined, false)).toBe("light");
    expect(resolveTheme("sepia", true)).toBe("dark");
  });
});

describe("isTheme", () => {
  it("reconnaît exactement les trois modes", () => {
    for (const t of THEMES) expect(isTheme(t)).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("reste aligné sur les modes et la clé de stockage", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    for (const t of THEMES) expect(THEME_INIT_SCRIPT).toContain(`"${t}"`);
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
  });
});
