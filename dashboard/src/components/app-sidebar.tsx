import Link from "next/link";
import { Carrot, CircleUser, LogOut } from "lucide-react";
import { logout } from "@/app/connexion/actions";
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
import type { CurrentUser } from "@/domain/auth/types";

/*
 * Colonne de gauche : en-tête (logo + nom), navigation, pied (utilisateur connecté
 * et déconnexion). Composant serveur : il assemble ; Sidebar et NavMain sont
 * clients en interne.
 *
 * variant="inset" : le contenu devient une carte flottante. collapsible="icon" :
 * la barre se réduit à ses icônes.
 *
 * A7 : l'utilisateur vient de verifySession() via le layout. Le bouton de
 * déconnexion est un formulaire dont l'action est la Server Action logout :
 * fonctionne sans JavaScript, pas de "use client".
 */
const ROLE_LABELS = {
  admin: "Administrateur",
  gestionnaire: "Gestionnaire",
  lecture: "Lecture seule",
} as const;

export function AppSidebar({ user }: { user: CurrentUser }) {
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
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-sidebar-foreground/70 text-xs">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={logout}>
              <SidebarMenuButton
                render={<button type="submit" />}
                tooltip="Se déconnecter"
              >
                <LogOut />
                <span>Se déconnecter</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
