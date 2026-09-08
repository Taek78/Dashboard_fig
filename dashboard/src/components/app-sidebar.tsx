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
 * collapsible="icon" : la barre se réduit à ses icônes au lieu de disparaître,
 * la navigation reste visible toute la journée et libère de la place au tableau.
 *
 * Le « logo » est un carré de couleur avec l'icône Carrot en attendant celui du
 * client : remplacer <Carrot /> par une <Image /> ne touchera rien d'autre.
 * En mode réduit, shadcn masque automatiquement les textes du header et du footer.
 *
 * Pied : render={<div />} et non un bouton, car un bouton focusable sans action est
 * un piège clavier. En A2 ce div deviendra le déclencheur d'un DropdownMenu.
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <Carrot className="size-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-medium">FIG Back-office</span>
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
              <CircleUser className="size-4" />
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
