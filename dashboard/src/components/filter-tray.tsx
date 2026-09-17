import type { ReactNode } from "react";
import Link from "next/link";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Panneau des filtres d'une recherche (serveur) : sous la barre de recherche,
 * une surface teintée (surface-tray) avec en tête l'intitulé et, à droite, le
 * lien de réinitialisation ; puis les champs passés en enfants, dans la grille
 * de l'appelant ; la zone de dates, quand il y en a une, vient en dernier,
 * pleine largeur (DateRangeFields, variante « row »). Les champs posés sur
 * la surface reprennent la couleur de la carte (règle de globals.css sur
 * data-slot="filter-tray"). Le lien est un vrai lien : il vide l'URL et
 * AutoSubmitForm remonte les champs.
 */
export function FilterTray({
  label = "Filtres",
  reset,
  children,
  className,
}: {
  /** Nom du groupe, affiché en tête. */
  label?: string;
  /** Lien de réinitialisation, déjà conditionné par l'appelant (null : aucun). */
  reset?: ResetLinkProps | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="filter-tray"
      className={cn(
        "surface-tray grid min-w-0 gap-3 rounded-xl p-3",
        className,
      )}
    >
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal
            className="text-primary size-4"
            aria-hidden="true"
          />
          {label}
        </span>
        {reset ? <ResetLink {...reset} /> : null}
      </div>
      {children}
    </div>
  );
}

export type ResetLinkProps = {
  href: string;
  label?: string;
  /** false : ne pas remonter la page (recherche au bas d'une fiche). */
  scroll?: boolean;
  className?: string;
};

/** Lien « Réinitialiser » d'une recherche : un vrai lien, jamais un bouton. */
export function ResetLink({
  href,
  label = "Réinitialiser",
  scroll,
  className,
}: ResetLinkProps) {
  return (
    <Link
      href={href}
      scroll={scroll}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "-my-1 -mr-1",
        className,
      )}
    >
      <RotateCcw />
      {label}
    </Link>
  );
}
