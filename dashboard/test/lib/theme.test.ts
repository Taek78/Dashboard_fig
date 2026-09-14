import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  isTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
} from "@/lib/theme";

describe("resolveTheme", () => {
  it("garde un choix mémorisé valide", () => {
    expect(resolveTheme("fig")).toBe("fig");
    expect(resolveTheme("light")).toBe("light");
  });

  it("revient au mode sombre quand rien n'est mémorisé ou que la valeur est inconnue", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
    expect(resolveTheme("sepia")).toBe("dark");
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
  it("reste aligné sur les modes, la clé de stockage et le mode par défaut", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    for (const t of THEMES) expect(THEME_INIT_SCRIPT).toContain(`"${t}"`);
    expect(THEME_INIT_SCRIPT).toContain(`t="${DEFAULT_THEME}"`);
    expect(THEME_INIT_SCRIPT).not.toContain("prefers-color-scheme");
  });
});
