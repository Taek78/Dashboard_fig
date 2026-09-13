import "server-only";
import { selectSource } from "@/data/select-source";
import type { OrdersSource } from "@/domain/orders/source";
import { ordersMock } from "@/data/orders.mock";

/*
 * FAÇADE des commandes : le seul module que le front importe pour lire des commandes.
 *
 * Pourquoi cette séparation (contrat dans src/domain, implémentations et façade ici) :
 *   1. Cacher l'implémentation. `source` n'est PAS exporté : le reste de l'app ne voit
 *      que des fonctions typées par le contrat (OrdersSource["getOrders"]). Personne ne
 *      peut atteindre ce qui n'est pas dans le contrat (resetOrdersMock() du mock, pool
 *      de connexions de la version Drizzle…).
 *   2. Une seule ligne change au branchement : le `null` passé à selectSource
 *      devient `ordersDb` (B3), et DATA_SOURCE=db active la base. Les exports ne
 *      bougent pas, donc aucune page n'est touchée.
 *   3. Un import lisible côté page : `import { getOrders } from "@/data/orders"` se lit
 *      comme une fonction métier, sans exposer un détail d'architecture.
 *
 * Les wrappers fléchés `() => source.getOrders()` (plutôt que `= source.getOrders`)
 * évitent de figer la référence au moment de l'import : si `source` devient choisie
 * dynamiquement, les exports pointent toujours vers la bonne implémentation.
 *
 * `import "server-only"` en ligne 1 : Next fait échouer le build si un composant
 * "use client" importe ce module. Rien à installer. Conséquence : les tests
 * n'importent jamais ce fichier (Vitest ne résout pas server-only), ils importent
 * orders.mock.ts ou src/domain/**.
 */
// B1 : choix par DATA_SOURCE. La version Drizzle (B3) remplacera le null.
const source: OrdersSource = selectSource("commandes", ordersMock, null);

export const getOrders: OrdersSource["getOrders"] = (filters) =>
  source.getOrders(filters);
export const getOrder: OrdersSource["getOrder"] = (id) => source.getOrder(id);
// A2 : écriture conditionnelle. resetOrdersMock() du mock n'est PAS réexportée : hors contrat.
export const updateOrderStatus: OrdersSource["updateOrderStatus"] = (
  id,
  from,
  to,
) => source.updateOrderStatus(id, from, to);
