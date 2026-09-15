import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { verifySession } from "@/lib/dal";

/*
 * Layout du groupe (dashboard) : la coquille autour de chaque page du back-office.
 * Rendu une fois, seul {children} change à la navigation.
 *
 * Il vit ici et non dans src/app/layout.tsx : le layout racine pose <html>/<body>,
 * les polices et les métadonnées ; /connexion en hérite sans la sidebar.
 *
 * verifySession() en tête. Sans session, redirection vers /connexion avant
 * de rendre quoi que ce soit (le proxy le fait déjà, ceinture et bretelles). Le
 * nom et le rôle affichés dans la sidebar et le bandeau viennent de la session,
 * jamais d'un paramètre.
 *
 * - SidebarProvider : contexte lu par SidebarTrigger, NavMain et Sidebar.
 * - Le lien d'évitement est le premier élément focusable.
 * - SidebarInset est le <main> ; id="contenu" est la cible du lien. Le fond
 *   (dégradé et motif) est posé sur toute la fenêtre par globals.css.
 * - min-w-0 sur le conteneur de page : un enfant large (tableau, graphe) défile
 *   dans son propre cadre au lieu d'élargir la page sur mobile.
 * - @container/main : le conteneur de page est un conteneur de requêtes. Les
 *   composants de page choisissent leur disposition selon SA largeur
 *   (@xl/main:, @2xl/main:, @4xl/main:…) et non celle de la fenêtre : à 768 px,
 *   la sidebar ouverte laisse ~440 px, repliée ~630 px, et la mise en page suit.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const user = await verifySession();

  return (
    <SidebarProvider>
      <a
        href="#contenu"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Aller au contenu
      </a>
      <AppSidebar user={user} />
      <SidebarInset
        id="contenu"
        tabIndex={-1}
        className="min-w-0 md:peer-data-[variant=inset]:rounded-2xl"
      >
        <SiteHeader user={user} />
        {/* Largeur bornée et marges généreuses : la lisibilité avant la densité. */}
        <div className="@container/main mx-auto flex w-full max-w-350 min-w-0 flex-1 flex-col gap-5 p-4 md:gap-6 md:p-6 xl:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
