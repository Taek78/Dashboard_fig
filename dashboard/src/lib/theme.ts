/*
 * Modes d'affichage : light, dark, fig. Le choix est mémorisé dans localStorage
 * (clé THEME_STORAGE_KEY) et posé sur <html data-theme> ; sans choix mémorisé, le
 * mode suit la préférence du système (sombre → dark, sinon light).
 *
 * resolveTheme est pure et testée. Le script inline de src/app/layout.tsx en
 * est la copie en JavaScript brut (il ne peut pas importer ce module) : garder
 * les deux alignés.
 */
export const THEMES = ["light", "dark", "fig"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "fig-theme";
export const DEFAULT_THEME: Theme = "light";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Clair",
  dark: "Sombre",
  fig: "Figue",
};

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "dark" : DEFAULT_THEME;
}

/** Script exécuté avant le premier rendu (voir layout.tsx) : évite le flash de thème. */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"&&t!=="fig"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;
