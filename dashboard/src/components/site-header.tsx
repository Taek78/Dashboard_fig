import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

/*
 * Bandeau du haut : le repère <header> de la page (un seul par page).
 * Composant serveur : SidebarTrigger et ThemeToggle sont clients en interne.
 * Collant, avec un léger flou du contenu qui défile dessous ; le nom de l'app
 * reste discret, le titre visible est le h1 du PageHeader.
 */
export function SiteHeader() {
  return (
    <header className="bg-card/70 supports-backdrop-filter:bg-card/50 sticky top-0 z-10 flex h-14 items-center gap-2 rounded-t-2xl border-b px-4 backdrop-blur md:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />
      <span className="text-muted-foreground text-sm font-medium">
        FIG Back-office
      </span>
      <ThemeToggle className="ml-auto" />
    </header>
  );
}
