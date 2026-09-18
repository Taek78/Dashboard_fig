import type { ReactNode } from "react";
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  socialHref,
  type SocialNetwork,
} from "@/lib/social";
import { cn } from "@/lib/utils";

/*
 * Pied du menu : FIG sur Facebook et Instagram (demande du 2026-09-18).
 * Composant serveur. Logos dessinés ici (lucide n'a plus de logos de marque),
 * dans les couleurs du thème au repos, à la couleur de leur réseau au survol
 * avec un néon léger. Adresse renseignée (src/lib/social.ts) : un lien qui
 * s'ouvre dans un nouvel onglet, sans rien transmettre de la page (noopener
 * noreferrer). Adresse vide : l'icône est là, estompée et en pointillés,
 * annoncée « bientôt disponible » ; elle réagit au survol mais ne mène nulle
 * part. Menu replié en icônes : les deux ronds s'empilent.
 */
const LOGOS: Record<SocialNetwork, ReactNode> = {
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.4 21v-7.7h2.6l.4-3h-3V8.4c0-.9.3-1.5 1.5-1.5h1.6V4.2a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"
    />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

/* Le rond : il monte d'un cran au survol, s'enfonce à l'appui. */
const ROUND =
  "group/social flex size-9 items-center justify-center rounded-full border outline-none motion-safe:transition-[color,border-color,background-color,box-shadow,translate,scale] motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-90";

/*
 * Survol et focus clavier : la couleur du réseau (tokens --facebook,
 * --instagram) et un NÉON léger, un halo de cette couleur autour du rond
 * (box-shadow) et du logo (drop-shadow), adouci par color-mix. Classes
 * écrites en entier : Tailwind ne voit pas un nom de classe construit.
 */
const TONE: Record<SocialNetwork, string> = {
  facebook:
    "hover:text-facebook hover:border-facebook/60 hover:bg-facebook/10 hover:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--facebook)_70%,transparent)] focus-visible:text-facebook focus-visible:border-facebook/60 focus-visible:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--facebook)_70%,transparent)] hover:[&_svg]:drop-shadow-[0_0_4px_var(--facebook)]",
  instagram:
    "hover:text-instagram hover:border-instagram/60 hover:bg-instagram/10 hover:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--instagram)_70%,transparent)] focus-visible:text-instagram focus-visible:border-instagram/60 focus-visible:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--instagram)_70%,transparent)] hover:[&_svg]:drop-shadow-[0_0_4px_var(--instagram)]",
};

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul
      aria-label="FIG sur les réseaux sociaux"
      className={cn(
        "flex items-center justify-center gap-2 group-data-[collapsible=icon]:flex-col",
        className,
      )}
    >
      {SOCIAL_NETWORKS.map((network) => {
        const href = socialHref(network);
        const label = SOCIAL_LABELS[network];
        const logo = (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
            className="size-4 motion-safe:transition-[scale,rotate,filter] motion-safe:duration-300 motion-safe:group-hover/social:scale-110 motion-safe:group-hover/social:-rotate-6"
          >
            {LOGOS[network]}
          </svg>
        );
        return (
          <li key={network}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`FIG sur ${label} (nouvel onglet)`}
                title={`FIG sur ${label}`}
                className={cn(
                  ROUND,
                  TONE[network],
                  "text-sidebar-foreground/80 focus-visible:ring-ring/50 focus-visible:ring-3",
                )}
              >
                {logo}
              </a>
            ) : (
              <span
                role="img"
                aria-label={`${label} : bientôt disponible`}
                title={`${label} : bientôt disponible`}
                className={cn(
                  ROUND,
                  TONE[network],
                  "text-sidebar-foreground/40 border-dashed",
                )}
              >
                {logo}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
