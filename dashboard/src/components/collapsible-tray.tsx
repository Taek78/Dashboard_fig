"use client";

import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Corps repliable du panneau des filtres (FilterTray), sur TOUTES les
 * recherches (demandes du 2026-09-18) : l'icône et l'intitulé « Filtres »
 * forment un bouton (aria-expanded) qui déroule ou replie les champs.
 * REPLIÉ PAR DÉFAUT, à toutes les largeurs : il faut cliquer pour dérouler.
 * Un filtre actif se voit quand même : le lien « Réinitialiser » reste dans
 * l'en-tête, à côté du bouton. L'état est retenu pour la page pendant la
 * visite (raccourcis de dates, « Réinitialiser » : le formulaire est recréé,
 * le panneau reste ouvert) ; un rechargement repart replié. Replié, un champ
 * reste dans le formulaire (display: none) : il garde sa valeur et part
 * toujours dans l'URL.
 */

/**
 * Panneaux ouverts pendant la visite (mémoire du module : elle survit aux
 * navigations dans l'application, pas au rechargement, qui repart replié).
 */
const OPENED = new Set<string>();

export function CollapsibleTray({
  label,
  reset,
  children,
}: {
  label: string;
  /** Le lien « Réinitialiser », rendu par le serveur. */
  reset: ReactNode;
  children: ReactNode;
}) {
  // Ouvert ou replié, retenu pour la page : un raccourci de date ou
  // « Réinitialiser » recrée le formulaire, le panneau reste comme il était.
  const key = `${usePathname()}|${label}`;
  const [open, setOpenState] = useState(() => OPENED.has(key));
  const setOpen = (next: boolean) => {
    if (next) OPENED.add(key);
    else OPENED.delete(key);
    setOpenState(next);
  };
  const bodyId = useId();

  return (
    <>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="hover:bg-foreground/5 focus-visible:ring-ring/50 -m-1 flex items-center gap-2 rounded-none p-1 text-sm font-medium outline-none focus-visible:ring-3 motion-safe:transition-[background-color,scale] motion-safe:active:scale-95"
        >
          <SlidersHorizontal
            className="text-primary size-4"
            aria-hidden="true"
          />
          {label}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "text-muted-foreground size-4 motion-safe:transition-transform motion-safe:duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        {reset}
      </div>
      <div
        id={bodyId}
        className={cn("min-w-0 flex-col gap-3", open ? "flex" : "hidden")}
      >
        {children}
      </div>
    </>
  );
}
