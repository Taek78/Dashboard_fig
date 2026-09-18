import Link from "next/link";
import { Carrot } from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { SocialLinks } from "@/components/social-links";
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
import type { CurrentUser } from "@/domain/auth/types";

/*
 * Colonne de gauche : en-tête (logo + nom), navigation, et au pied FIG sur
 * Facebook et Instagram (SocialLinks, 2026-09-18). L'utilisateur connecté et
 * « Se déconnecter » sont dans le bandeau, en haut à droite (SiteHeader). Composant
 * serveur : il assemble ; Sidebar et NavMain sont clients en interne.
 *
 * variant="inset" : le contenu devient une carte flottante. collapsible="icon" :
 * la barre se réduit à ses icônes.
 *
 * L'utilisateur vient de verifySession() via le layout (son rôle choisit les
 * sections du menu).
 */
export function AppSidebar({ user }: { user: CurrentUser }) {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              tooltip="FIG Back-office"
            >
              <div className="bg-gradient-brand ring-primary/20 flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md ring-2">
                <Carrot className="size-4" />
              </div>
              <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="text-gradient-brand text-base font-bold tracking-tight">
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
        <NavMain role={user.role} />
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border mb-4 border-t pt-3 pb-3">
        <SocialLinks />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
