import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/*
 * Bandeau du haut : le repère <header> de la page (un seul par page).
 * Composant serveur : il ne fait que rendre SidebarTrigger, qui est client en
 * interne et lit le contexte de SidebarProvider (donc inutilisable hors layout).
 * Collant en haut avec un léger flou du contenu qui défile dessous ; le nom de
 * l'app reste discret (text-sm), le titre visible est le h1 du PageHeader.
 */
export function SiteHeader() {
  return (
    <header className="bg-card/80 supports-backdrop-filter:bg-card/60 sticky top-0 z-10 flex h-12 items-center gap-2 rounded-t-xl border-b px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />
      <span className="text-muted-foreground text-sm font-medium">
        FIG Back-office
      </span>
    </header>
  );
}
