import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Bandeau BLEU (token --info) quand une recherche par dates ne trouve rien
 * (serveur) : ce n'est ni une erreur ni une liste vide, juste une période sans
 * activité, et l'équipe doit le voir d'un coup d'œil (demande du client). Le
 * texte porte les dates ; un lien ramène à toutes les dates en gardant les
 * autres filtres.
 */
export function PeriodEmptyNotice({
  text,
  resetHref,
  resetLabel = "Toutes les dates",
  className,
}: {
  text: string;
  resetHref?: string;
  resetLabel?: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "bg-info/10 text-info ring-info/30 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-none px-4 py-3 text-sm font-medium ring-1",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <CalendarX2 className="size-5 shrink-0" aria-hidden="true" />
        {text}
      </span>
      {resetHref ? (
        <Link
          href={resetHref}
          className="font-semibold underline underline-offset-4"
        >
          {resetLabel}
        </Link>
      ) : null}
    </p>
  );
}
