import { Star } from "lucide-react";
import {
  CUSTOMER_TIER_LABELS,
  CUSTOMER_TIER_STARS,
  CUSTOMER_TIERS,
  type CustomerTierState,
} from "@/domain/customers/tier";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Catégorie d'un client (serveur) : des étoiles et un libellé, en couleur
 * (token --loyal, or, pour « fidèle » ; neutre pour « basique »). Autant
 * d'étoiles pleines que la catégorie en vaut, sur le maximum possible : la
 * hiérarchie se lit d'un coup d'œil, et le texte porte l'information pour qui
 * ne voit pas la couleur. Un fidèle indique jusqu'à quand.
 */
const MAX_STARS = Math.max(
  ...CUSTOMER_TIERS.map((t) => CUSTOMER_TIER_STARS[t]),
);

export function TierBadge({
  state,
  showUntil = false,
  className,
}: {
  state: CustomerTierState;
  /** Ajoute « jusqu'au … » après le libellé (fiche). */
  showUntil?: boolean;
  className?: string;
}) {
  const stars = CUSTOMER_TIER_STARS[state.tier];
  const label = CUSTOMER_TIER_LABELS[state.tier];
  const loyal = state.tier === "loyal";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold",
        loyal
          ? "bg-loyal/15 text-loyal ring-loyal/40 ring-1"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < stars ? "fill-current" : "opacity-40",
            )}
          />
        ))}
      </span>
      <span>
        <span className="sr-only">Catégorie : </span>
        {label}
        {showUntil && loyal && state.until
          ? ` jusqu'au ${formatDateFr(state.until)}`
          : null}
      </span>
    </span>
  );
}
