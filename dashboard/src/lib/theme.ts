/*
 * Modes d'affichage : light, dark, fig. Le choix est mémorisé dans localStorage
 * (clé THEME_STORAGE_KEY) et posé sur <html data-theme> ; sans choix mémorisé,
 * le mode est sombre (choix produit), quelle que soit la préférence du système.
 *
 * resolveTheme est pure et testée. Le script inline de src/app/layout.tsx en
 * est la copie en JavaScript brut (il ne peut pas importer ce module) : garder
 * les deux alignés.
 */
export const THEMES = ["light", "dark", "fig"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "fig-theme";
export const DEFAULT_THEME: Theme = "dark";

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

/** Choix mémorisé s'il est valide, sinon le mode par défaut (sombre). */
export function resolveTheme(stored: string | null | undefined): Theme {
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

/** Script exécuté avant le premier rendu (voir layout.tsx) : évite le flash de thème. */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"&&t!=="fig"){t="${DEFAULT_THEME}"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}")}})();`;
