import Link from "next/link";
import { Carrot } from "lucide-react";
import { SiteBreadcrumb } from "@/components/site-breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/domain/auth/roles";
import type { CurrentUser } from "@/domain/auth/types";
import { initials } from "@/lib/text";

/*
 * Bandeau du haut : le repère <header> de la page (un seul par page). Composant
 * serveur : SidebarTrigger, SiteBreadcrumb et ThemeToggle sont clients en interne.
 *
 * De gauche à droite : le bouton du menu, la marque (mobile seulement : sur
 * grand écran elle est déjà dans la sidebar), le fil d'Ariane (grand écran), puis
 * le sélecteur de mode et l'utilisateur connecté (initiales, nom et rôle dès lg).
 * Collant, translucide avec flou, signé par un trait au dégradé de marque.
 * Le titre visible de la page reste le h1 du PageHeader.
 */
export function SiteHeader({ user }: { user: CurrentUser }) {
  const who = `${user.name} · ${ROLE_LABELS[user.role]}`;

  return (
    <header className="bg-card/75 supports-backdrop-filter:bg-card/60 sticky top-0 z-10 backdrop-blur-md md:rounded-t-2xl">
      <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:gap-3 md:px-6">
        <SidebarTrigger
          size="icon"
          className="bg-card hover:bg-muted shrink-0 rounded-full border shadow-sm"
        />

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
          <span className="text-gradient-brand text-base font-semibold tracking-tight">
            FIG
          </span>
        </Link>

        <SiteBreadcrumb className="hidden md:block" />

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2" title={who}>
            <span
              aria-hidden="true"
              className="bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
            >
              {initials(user.name)}
            </span>
            <span className="hidden flex-col leading-tight lg:flex">
              <span className="max-w-40 truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <span className="sr-only lg:hidden">{who}</span>
          </div>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="bg-gradient-brand block h-px w-full opacity-60"
      />
    </header>
  );
}
