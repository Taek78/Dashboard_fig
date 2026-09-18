import Link from "next/link";
import { Carrot } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewItemsDot } from "@/components/alerts/new-items-dot";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/domain/auth/roles";
import type { CurrentUser } from "@/domain/auth/types";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";

/*
 * Bandeau du haut : le repère <header> de la page (un seul par page). Composant
 * serveur : SidebarTrigger, ThemeToggle et LogoutButton sont clients en
 * interne.
 *
 * Refonte du 2026-09-18 (demande de l'auteur) : bords droits, une ligne
 * neutre en bas au lieu du trait en dégradé, et deux groupes nets séparés par
 * de fins traits verticaux :
 * - à gauche, le bouton qui commande le menu (PanelToggleIcon : il montre le
 *   panneau et le sens du prochain clic), SANS texte à côté (demande du
 *   2026-09-18 : ni fil d'Ariane, ni nom ; le titre de la page dit où l'on
 *   est), et sur mobile le seul logo, lien vers l'accueil ;
 * - à droite, QUI l'on est : le mode d'affichage, le badge utilisateur
 *   (pastille d'initiales unie, nom dès lg, rôle dans le libellé ; lien vers
 *   son profil), puis le bouton marche / arrêt de déconnexion (LogoutButton,
 *   avec confirmation), qui a quitté le pied de la sidebar pour être là où on
 *   le cherche, en haut à droite, juste après son nom.
 * Collant et translucide avec flou : le contenu défile dessous. Le titre
 * visible de la page reste le h1 du PageHeader.
 */
function Divider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-border h-6 w-px shrink-0", className)}
    />
  );
}

export function SiteHeader({ user }: { user: CurrentUser }) {
  const role = ROLE_LABELS[user.role];

  return (
    <header className="bg-card/70 supports-backdrop-filter:bg-card/55 border-border/70 sticky top-0 z-10 border-b backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:gap-3 md:px-6">
        <span className="relative shrink-0">
          <SidebarTrigger
            size="icon"
            className="bg-card/70 text-foreground border-foreground/15 hover:bg-muted hover:border-primary/50 size-10 shrink-0 rounded-xl border shadow-sm"
          />
          {/* Téléphone : nouvelle commande ou nouveau message, menu replié. */}
          <NewItemsDot />
        </span>

        <Link
          href="/"
          aria-label="Accueil FIG Back-office"
          className="flex items-center gap-2 md:hidden"
        >
          <span
            aria-hidden="true"
            className="bg-gradient-brand flex size-8 items-center justify-center rounded-lg text-white shadow-sm"
          >
            <Carrot className="size-4" />
          </span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Divider className="hidden sm:block" />

          {/* Badge utilisateur : les initiales dans une pastille unie, le nom
              à côté dès lg ; le rôle est dans le libellé et l'info-bulle. */}
          <Link
            href="/profil"
            aria-label={`${user.name}, ${role} : mon profil`}
            title={`${user.name} · ${role}`}
            className="bg-card/60 hover:bg-muted hover:border-primary/40 focus-visible:ring-ring/50 flex min-w-0 items-center gap-2 rounded-full border p-0.5 transition-colors outline-none focus-visible:ring-3 lg:pr-3.5"
          >
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            >
              {initials(user.name)}
            </span>
            <span className="hidden max-w-36 truncate text-sm font-medium lg:block">
              {user.name}
            </span>
          </Link>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
