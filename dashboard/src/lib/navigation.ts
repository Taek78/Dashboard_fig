import {
  Carrot,
  ChartColumn,
  LayoutDashboard,
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
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Métriques", href: "/metriques", icon: ChartColumn },
] as const;

/** La racine n'est active que sur "/" ; une section reste active sur ses sous-pages. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
