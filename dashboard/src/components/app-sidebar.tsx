import Link from "next/link";
import { Carrot, CircleUser } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

/*
 * Colonne de gauche : en-tête (logo + nom), navigation, pied (utilisateur).
 *
 * Composant serveur : il ne fait qu'assembler. Sidebar est client en interne,
 * NavMain est client ; un composant serveur peut rendre des composants clients.
 *
 * variant="inset" : la sidebar se fond dans le fond de page et le contenu devient
 * une carte flottante arrondie (voir SidebarInset). collapsible="icon" : la barre
 * se réduit à ses icônes au lieu de disparaître.
 *
 * Le « logo » est un carré au dégradé de marque avec l'icône Carrot en attendant
 * celui du client : remplacer <Carrot /> par une <Image /> ne touchera rien d'autre.
 *
 * Pied : render={<div />} et non un bouton, car un bouton focusable sans action est
 * un piège clavier. En A2 ce div deviendra le déclencheur d'un DropdownMenu.
 */
export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="bg-gradient-brand flex size-8 items-center justify-center rounded-lg text-white shadow-sm">
                <Carrot className="size-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold tracking-tight">
                  FIG Back-office
                </span>
                <span className="text-sidebar-foreground/70 text-xs">
                  Livraison de fruits et légumes
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<div />}>
              <div className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 items-center justify-center rounded-full">
                <CircleUser className="size-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-medium">Utilisateur démo</span>
                <span className="text-sidebar-foreground/70 text-xs">
                  Gestionnaire
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
