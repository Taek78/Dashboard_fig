"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { canViewSection, type Role } from "@/domain/auth/roles";
import { isNavActive, NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

/*
 * Liste des liens de la sidebar. Seul composant client de la coquille :
 * usePathname() (état actif) et setOpenMobile (fermer le panneau après un clic
 * sur mobile) sont des hooks. Le <nav> donne le repère « navigation » aux
 * lecteurs d'écran, les composants shadcn rendant des div/ul/li.
 * La prop `render` de base-nova fait rendre le bouton sous forme de <Link>.
 * Les sections interdites au rôle (matrice SECTION_ACCESS) ne sont pas listées ;
 * le proxy les refuse de toute façon.
 */
export function NavMain({ role }: { role: Role }) {
  const pathname = usePathname();

  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarGroupContent>
        <nav aria-label="Navigation principale">
          <SidebarMenu>
            {NAV_ITEMS.filter((item) => canViewSection(role, item.href)).map(
              (item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "h-9 rounded-xl transition-colors",
                        active &&
                          "bg-gradient-brand! text-white! shadow-sm hover:brightness-105",
                      )}
                      onClick={() => setOpenMobile(false)}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              },
            )}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
