"use client";

import { Grape, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  isTheme,
  THEME_LABELS,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
 * Sélecteur de mode (client : il lit et écrit l'attribut data-theme de <html>).
 * useSyncExternalStore : la source de vérité est le DOM, pas un état React ; le
 * rendu serveur suppose "light" et le script inline du layout a déjà posé la
 * bonne valeur avant l'hydratation, d'où suppressHydrationWarning sur <html>.
 */
const listeners = new Set<() => void>();

function readTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : DEFAULT_THEME;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la page.
  }
  for (const listener of listeners) listener();
}

const ICONS = { light: Sun, dark: Moon, fig: Grape } as const;

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  return (
    <div
      role="group"
      aria-label="Mode d'affichage"
      className={cn(
        "bg-muted/60 inline-flex items-center gap-0.5 rounded-full border p-0.5",
        className,
      )}
    >
      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const active = option === theme;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={THEME_LABELS[option]}
            onClick={() => applyTheme(option)}
            className={cn(
              "focus-visible:ring-ring/50 group/theme inline-flex size-7 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3 motion-safe:transition-[color,background-color,box-shadow,scale] motion-safe:active:scale-90",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/theme:rotate-12",
                active && "motion-safe:scale-110",
              )}
              aria-hidden="true"
            />
            <span className="sr-only">{THEME_LABELS[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
