/*
 * A1.4 — Navigation de la coquille (voir docs/a1-spec-ui.md partie 1).
 *
 * À écrire ici :
 *   - export const NAV_ITEMS = [ { title, href, icon }, ... ] as const
 *     (Tableau de bord "/", Commandes, Catalogue, Clients, Métriques ; icônes lucide :
 *      LayoutDashboard, ShoppingBasket, Carrot, Users, ChartColumn)
 *   - export function isNavItemActive(pathname: string, href: string): boolean
 *     → égalité stricte pour "/", sinon pathname === href || pathname.startsWith(href + "/")
 *     testée dans navigation.test.ts (3 cas : racine, section, sous-page).
 */
export {};
