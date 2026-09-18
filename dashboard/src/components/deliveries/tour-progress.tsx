import {
  TOUR_STAGE_LABELS,
  type TourProgress as Progress,
} from "@/domain/deliveries/rules";
import type { OrderStatus } from "@/domain/orders/status";
import { cn } from "@/lib/utils";

/*
 * Avancement du traitement des livraisons (serveur). Une barre segmentée par
 * statut, de ce qui est terminé (à gauche) à ce qui reste à faire (à droite),
 * un titre chiffré (« 8 sur 20 traitées · 12 à traiter », « 40 % ») et une
 * légende qui nomme chaque segment avec son nombre : la couleur n'est jamais le
 * seul signal. Les segments grandissent en proportion (flex-grow = nombre) et
 * gardent une largeur minimale : une seule commande reste visible.
 * Variante `compact` pour l'en-tête d'un jour : barre fine, résumé court, sans
 * légende (celle du haut de page vaut pour tous les jours).
 * Couleurs : celles des cartes (STATUS_ACCENT), en tokens.
 */
const SEGMENT_COLOR: Record<OrderStatus, string> = {
  delivered: "bg-success",
  cancelled: "bg-destructive/60",
  delivering: "bg-delivering",
  preparing: "bg-warning",
};

export function TourProgress({
  progress,
  label,
  compact = false,
}: {
  /** Déjà calculé : tourProgress(commandes) ou tourProgressFromCounts(totaux de la base). */
  progress: Progress;
  /** Nom accessible de la barre. */
  label: string;
  compact?: boolean;
}) {
  if (progress.total === 0) return null;
  const treated = `traitée${progress.done > 1 ? "s" : ""}`;
  const percent = `${progress.percentDone}\u00A0%`;

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={cn("tabular-nums", compact ? "text-xs" : "text-sm")}>
          <span className={cn("font-semibold", !compact && "text-base")}>
            {progress.done} sur {progress.total}
          </span>{" "}
          {treated}
          {progress.remaining > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              · {progress.remaining} à traiter
            </span>
          ) : (
            <span className="text-success font-medium"> · tout est traité</span>
          )}
        </p>
        <p
          aria-hidden="true"
          className={cn(
            "font-semibold tabular-nums",
            compact ? "text-xs" : "text-2xl leading-none",
          )}
        >
          {percent}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={`${progress.done} sur ${progress.total} ${treated} (${percent})`}
        className={cn(
          "bg-muted flex w-full gap-0.5 overflow-hidden rounded-full",
          compact ? "h-1.5" : "h-3",
        )}
      >
        {progress.segments.map((segment) => (
          <div
            key={segment.status}
            title={`${TOUR_STAGE_LABELS[segment.status]} : ${segment.count}`}
            className={cn("h-full min-w-1", SEGMENT_COLOR[segment.status])}
            style={{ flexGrow: segment.count, flexBasis: 0 }}
          />
        ))}
      </div>

      {compact ? null : (
        <>
          <ul
            aria-label="Détail par statut"
            className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm"
          >
            {progress.segments.map((segment) => (
              <li key={segment.status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    SEGMENT_COLOR[segment.status],
                  )}
                />
                <span className="text-muted-foreground">
                  {TOUR_STAGE_LABELS[segment.status]}
                </span>
                <span className="font-medium tabular-nums">
                  {segment.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
