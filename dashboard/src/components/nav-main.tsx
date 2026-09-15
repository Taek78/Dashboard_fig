"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
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
import { groupNavItems, isNavActive, NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/*
 * Liens de la sidebar, rangés par groupe (Activité, Offre, Clients et équipe,
 * Pilotage). Seul composant client de la coquille : usePathname() (état actif)
 * et setOpenMobile (fermer le panneau après un clic sur mobile) sont des hooks.
 * Un seul <nav> englobe les groupes : le repère « navigation » reste unique pour
 * les lecteurs d'écran. Chaque icône a sa pastille ; le lien actif prend le
 * dégradé de marque. Sur mobile, les liens sont plus hauts (doigt) et glissent
 * l'un après l'autre à l'ouverture (--nav-index, animation dans globals.css).
 * Menu replié en icônes : l'intitulé d'un groupe devient transparent et remonte
 * sur le groupe précédent (-mt-8 du composant shadcn) ; pointer-events-none
 * l'empêche de capter les clics destinés au dernier lien de ce groupe.
 * Les sections interdites au rôle ne sont pas listées ; le proxy les refuse
 * de toute façon.
 */
export function NavMain({ role }: { role: Role }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = NAV_ITEMS.filter((item) => canViewSection(role, item.href));

  return (
    <nav aria-label="Navigation principale" className="flex flex-col">
      {groupNavItems(visible).map((group) => (
        <SidebarGroup key={group.group} className="py-1">
          <SidebarGroupLabel className="text-[0.68rem] font-semibold tracking-wider uppercase group-data-[collapsible=icon]:pointer-events-none">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <SidebarMenuItem
                    key={item.href}
                    style={
                      { "--nav-index": visible.indexOf(item) } as CSSProperties
                    }
                  >
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      className={cn(
                        "h-11 gap-3 rounded-xl text-[0.95rem] transition-colors md:h-9 md:text-sm",
                        active
                          ? "bg-gradient-brand! shadow-primary/25 font-semibold text-white! shadow-md hover:brightness-105"
                          : "text-sidebar-foreground/85",
                      )}
                      onClick={() => setOpenMobile(false)}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                        />
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:bg-transparent md:size-6",
                          active
                            ? "bg-white/20"
                            : "bg-sidebar-accent/70 text-sidebar-foreground/80",
                        )}
                      >
                        <item.icon />
                      </span>
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}
