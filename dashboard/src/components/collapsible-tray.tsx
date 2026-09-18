"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Corps repliable du panneau des filtres (FilterTray), pour le TÉLÉPHONE
 * (demande du 2026-09-18) : sur une zone de contenu étroite (sous @xl/main),
 * les filtres occupaient tout le premier écran avant le premier résultat.
 * L'intitulé devient alors un bouton « Filtres » (aria-expanded) qui ouvre ou
 * ferme les champs ; il est ouvert d'emblée quand un filtre est actif
 * (`defaultOpen`), pour qu'on voie ce qui restreint la liste. Sur une zone
 * plus large, rien ne change : intitulé simple, champs toujours visibles.
 * Replié, un champ reste dans le formulaire (display: none) : il garde sa
 * valeur et part toujours dans l'URL.
 */
export function CollapsibleTray({
  label,
  reset,
  defaultOpen,
  children,
}: {
  label: string;
  /** Le lien « Réinitialiser », rendu par le serveur. */
  reset: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const icon = (
    <SlidersHorizontal className="text-primary size-4" aria-hidden="true" />
  );

  return (
    <>
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="focus-visible:ring-ring/50 -m-1 flex items-center gap-2 rounded-md p-1 text-sm font-medium outline-none focus-visible:ring-3 @xl/main:hidden"
        >
          {icon}
          {label}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "text-muted-foreground size-4 motion-safe:transition-transform motion-safe:duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        <span className="hidden items-center gap-2 text-sm font-medium @xl/main:flex">
          {icon}
          {label}
        </span>
        {reset}
      </div>
      <div
        id={bodyId}
        className={cn(
          "min-w-0 flex-col gap-3 @xl/main:flex",
          open ? "flex" : "hidden",
        )}
      >
        {children}
      </div>
    </>
  );
}
