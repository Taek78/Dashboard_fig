import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/*
 * Layout du groupe (dashboard) : la coquille autour de chaque page du back-office.
 * Rendu une fois, seul {children} change à la navigation.
 *
 * Il vit ici et non dans src/app/layout.tsx : le layout racine pose <html>/<body>,
 * les polices et les métadonnées, et une future page hors coquille (/connexion)
 * doit pouvoir en hériter sans la sidebar.
 *
 * - SidebarProvider : contexte lu par SidebarTrigger, NavMain et Sidebar
 *   (useSidebar lève une erreur sans lui) ; gère ouvert/fermé, mobile, Ctrl+B.
 * - Le lien d'évitement est le premier élément focusable : invisible jusqu'au
 *   focus clavier, il saute la navigation vers le <main>.
 * - SidebarInset est le <main> ; id="contenu" est la cible du lien, tabIndex={-1}
 *   permet de lui donner le focus sans l'ajouter à l'ordre de tabulation.
 * - {children} est rendu une seule fois, dans la zone avec marges.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <a
        href="#contenu"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Aller au contenu
      </a>
      <AppSidebar />
      <SidebarInset id="contenu" tabIndex={-1}>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
