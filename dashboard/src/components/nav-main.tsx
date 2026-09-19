"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
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
import { useUnread } from "@/components/alerts/use-unread";
import { readKindOfSection } from "@/domain/alerts/rules";
import { ALERT_KINDS_READ, SECTION_OF_READ_KIND } from "@/domain/alerts/types";
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
 * Compteurs NON LUS (demande du 2026-09-18) : à côté de Commandes, Messages
 * et Catalogue (stock critique ou à 0), le nombre de nouveautés depuis la
 * dernière visite de la section, calculé par le serveur et publié par le
 * relevé des alertes (useUnread) ; la section s'ILLUMINE (halo qui respire,
 * `nav-lit` de globals.css, immobile sous prefers-reduced-motion). Cliquer
 * sur la section (ou l'ouvrir autrement) enregistre la visite : le badge
 * disparaît.
 */
export function NavMain({ role }: { role: Role }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const visible = NAV_ITEMS.filter((item) => canViewSection(role, item.href));
  // Compteurs non lus publiés par le relevé des alertes (serveur).
  const { counts, markSeen } = useUnread();
  // La section ouverte (clic ou lien direct) : sa dernière visite est
  // enregistrée, son compteur repart de zéro.
  useEffect(() => {
    for (const kind of ALERT_KINDS_READ) {
      if (
        counts[kind] > 0 &&
        isNavActive(pathname, SECTION_OF_READ_KIND[kind])
      ) {
        markSeen(kind);
      }
    }
  }, [pathname, counts, markSeen]);

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
                const kind = readKindOfSection(item.href);
                const count = kind === null || active ? 0 : counts[kind];
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
                        count > 0 &&
                          "nav-lit text-sidebar-foreground font-semibold",
                      )}
                      onClick={() => {
                        setOpenMobile(false);
                        // Le badge disparaît au clic, avant même la navigation.
                        if (kind !== null && count > 0) markSeen(kind);
                      }}
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
                      {count > 0 ? (
                        <span className="bg-primary text-primary-foreground ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:-right-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:px-1">
                          {count}
                          <span className="sr-only">
                            {count > 1 ? " nouveautés" : " nouveauté"}
                          </span>
                        </span>
                      ) : null}
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
