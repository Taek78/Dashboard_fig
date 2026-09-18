import {
  Carrot,
  ChartColumn,
  Contact,
  Inbox,
  LayoutDashboard,
  Newspaper,
  ScrollText,
  ShoppingBasket,
  UserCog,
  Users,
} from "lucide-react";

/*
 * Navigation de la coquille : une seule liste, lue par la sidebar et par le fil
 * d'Ariane. Les `href` sont les dossiers de routes de
 * src/app/(dashboard)/ : un href qui ne correspond à aucun dossier donne un 404.
 * Les icônes sont les composants lucide eux-mêmes (pas leur nom en chaîne),
 * pour que nav-main.tsx les rende directement avec <item.icon />.
 * Chaque entrée appartient à un groupe : le menu les range sous un intitulé,
 * plus lisible qu'une liste de neuf liens. Les livraisons se suivent depuis
 * Commandes (raccourcis des 7 derniers jours) : plus de section à part.
 */
export const NAV_GROUPS = [
  "activite",
  "offre",
  "relations",
  "pilotage",
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];
export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  activite: "Activité",
  offre: "Offre",
  relations: "Clients et équipe",
  pilotage: "Pilotage",
};

export const NAV_ITEMS = [
  {
    title: "Tableau de bord",
    href: "/",
    icon: LayoutDashboard,
    group: "activite",
  },
  {
    title: "Commandes",
    href: "/commandes",
    icon: ShoppingBasket,
    group: "activite",
  },
  { title: "Catalogue", href: "/catalogue", icon: Carrot, group: "offre" },
  { title: "Articles", href: "/articles", icon: Newspaper, group: "offre" },
  { title: "Clients", href: "/clients", icon: Users, group: "relations" },
  { title: "Messages", href: "/messages", icon: Inbox, group: "relations" },
  { title: "Personnel", href: "/personnel", icon: Contact, group: "relations" },
  {
    title: "Métriques",
    href: "/metriques",
    icon: ChartColumn,
    group: "pilotage",
  },
  { title: "Comptes", href: "/comptes", icon: UserCog, group: "pilotage" },
  {
    title: "Journal",
    href: "/journal",
    icon: ScrollText,
    group: "pilotage",
  },
] as const;

/**
 * Range des entrées (déjà filtrées par rôle) sous leurs groupes, dans l'ordre
 * de NAV_GROUPS ; un groupe sans entrée n'apparaît pas. Un groupe réduit à UNE
 * entrée prend le nom de cette entrée : pour le livreur, « Clients et
 * équipe » ne contient que Clients et s'appelle donc « Clients ».
 */
export function groupNavItems<T extends { group: NavGroup; title: string }>(
  items: readonly T[],
): { group: NavGroup; label: string; items: T[] }[] {
  return NAV_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }))
    .filter((entry) => entry.items.length > 0)
    .map((entry) => ({
      ...entry,
      label:
        entry.items.length === 1
          ? entry.items[0]!.title
          : NAV_GROUP_LABELS[entry.group],
    }));
}

/** La racine n'est active que sur "/" ; une section reste active sur ses sous-pages. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Un maillon du fil d'Ariane : `href` null = la page courante (non cliquable). */
export type Crumb = { title: string; href: string | null };

/**
 * Fil d'Ariane d'un chemin, à partir des sections de NAV_ITEMS :
 * "/commandes" → [Commandes] ; "/commandes/cmd-1" → [Commandes › Détail] ;
 * "/catalogue/nouveau" → [Catalogue › Nouveau] ; chemin inconnu → [].
 */
export function breadcrumbFor(pathname: string): Crumb[] {
  const section = NAV_ITEMS.find((item) => isNavActive(pathname, item.href));
  if (!section) return [];
  if (pathname === section.href) return [{ title: section.title, href: null }];
  const leaf = pathname.endsWith("/nouveau") ? "Nouveau" : "Détail";
  return [
    { title: section.title, href: section.href },
    { title: leaf, href: null },
  ];
}
