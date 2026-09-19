import type { ReactNode } from "react";
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  socialHref,
  socialLinkLabel,
  type SocialNetwork,
} from "@/lib/social";
import { cn } from "@/lib/utils";

/*
 * Pied du menu : Facebook et Instagram (demande du 2026-09-18). Composant
 * serveur. Logos dessinés ici (lucide n'a plus de logos de marque), EN
 * COULEUR dès le repos, à la couleur de leur réseau (tokens --facebook,
 * --instagram, clairs sur fond sombre et soutenus sur fond clair), pour se
 * voir nettement ; au survol, un néon léger. Chaque icône est un lien, jamais
 * mort : la page de FIG si elle est renseignée, sinon la page d'accueil du
 * réseau (src/lib/social.ts). Nouvel onglet, sans rien transmettre de la page
 * (noopener noreferrer). Menu replié en icônes : les deux ronds s'empilent.
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
  "group/social flex size-9 items-center justify-center rounded-none border outline-none motion-safe:transition-[color,border-color,background-color,box-shadow,translate,scale] motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-90";

/*
 * Au repos, la couleur du réseau (logo, contour, fond léger) ; au survol et
 * au focus clavier, un NÉON léger : un halo de cette couleur autour du rond
 * (box-shadow) et du logo (drop-shadow), adouci par color-mix. Classes
 * écrites en entier : Tailwind ne voit pas un nom de classe construit.
 */
const TONE: Record<SocialNetwork, string> = {
  facebook:
    "text-facebook border-facebook/50 bg-facebook/10 hover:border-facebook hover:bg-facebook/20 hover:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--facebook)_70%,transparent)] focus-visible:text-facebook focus-visible:border-facebook/60 focus-visible:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--facebook)_70%,transparent)] hover:[&_svg]:drop-shadow-[0_0_4px_var(--facebook)]",
  instagram:
    "text-instagram border-instagram/50 bg-instagram/10 hover:border-instagram hover:bg-instagram/20 hover:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--instagram)_70%,transparent)] focus-visible:text-instagram focus-visible:border-instagram/60 focus-visible:shadow-[0_0_14px_-2px_color-mix(in_oklch,var(--instagram)_70%,transparent)] hover:[&_svg]:drop-shadow-[0_0_4px_var(--instagram)]",
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
            <a
              href={socialHref(network)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={socialLinkLabel(network)}
              title={label}
              className={cn(
                ROUND,
                TONE[network],
                "focus-visible:ring-ring/50 focus-visible:ring-3",
              )}
            >
              {logo}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
