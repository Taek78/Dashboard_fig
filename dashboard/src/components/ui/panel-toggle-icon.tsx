import { cn } from "@/lib/utils";

/*
 * Icône du bouton qui commande le menu (2026-09-18) : elle MONTRE ce qu'elle
 * commande. Un cadre (la fenêtre) avec, à gauche, le panneau du menu, et un
 * chevron qui dit le sens du prochain clic.
 * - menu ouvert : panneau large et teinté, chevron vers la gauche (replier) ;
 * - menu replié ou fermé : panneau réduit à un liseré, chevron vers la droite
 *   (déplier, ouvrir).
 * Chaque changement s'anime : le panneau s'élargit ou se resserre, le chevron
 * pivote ; au survol du bouton (`group/trigger`), le chevron glisse d'un cran
 * dans le sens de l'action. `motion-safe:` partout : immobile si le poste
 * demande moins d'animations. Décorative : le bouton porte son libellé.
 */
export function PanelToggleIcon({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  const motion =
    "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      {/* Le panneau du menu : sa largeur dit s'il est ouvert. */}
      <rect
        x="3.5"
        y="4.5"
        width="6"
        height="15"
        rx="1.5"
        fill="currentColor"
        stroke="none"
        className={cn(
          "text-primary origin-left [transform-box:fill-box]",
          motion,
          open ? "scale-x-100 opacity-35" : "scale-x-[0.3] opacity-60",
        )}
      />
      {/* La fenêtre. */}
      <rect x="3" y="4" width="18" height="16" rx="3" />
      {/* Le sens du prochain clic. */}
      <g
        className={cn(
          "[transform-origin:center] [transform-box:fill-box]",
          motion,
          open
            ? "motion-safe:group-hover/trigger:-translate-x-0.5"
            : "motion-safe:group-hover/trigger:translate-x-0.5",
        )}
      >
        <path
          d="M16.5 9 13.5 12l3 3"
          className={cn(
            "[transform-origin:center] [transform-box:fill-box]",
            motion,
            open ? "rotate-0" : "rotate-180",
          )}
        />
      </g>
    </svg>
  );
}
