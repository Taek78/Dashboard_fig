import {
  Carrot,
  ChartColumn,
  LayoutDashboard,
  Newspaper,
  ShoppingBasket,
  Truck,
  Users,
} from "lucide-react";

/*
 * Navigation de la coquille : une seule liste, lue par la sidebar (A1.4) et
 * plus tard par le fil d'Ariane. Les `href` sont les dossiers de routes de
 * src/app/(dashboard)/ : un href qui ne correspond à aucun dossier donne un 404.
 * Les icônes sont les composants lucide eux-mêmes (pas leur nom en chaîne),
 * pour que nav-main.tsx les rende directement avec <item.icon />.
 */
export const NAV_ITEMS = [
  { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { title: "Commandes", href: "/commandes", icon: ShoppingBasket },
  { title: "Livraisons", href: "/livraisons", icon: Truck },
  { title: "Catalogue", href: "/catalogue", icon: Carrot },
  { title: "Articles", href: "/articles", icon: Newspaper },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Métriques", href: "/metriques", icon: ChartColumn },
] as const;

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
