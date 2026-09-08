import "server-only";
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
 *   2. Une seule ligne change au branchement : `const source = ordersMock` devient
 *      `ordersDb` (ou un choix selon DATA_SOURCE en B1). Les exports ne bougent pas,
 *      donc aucune page n'est touchée.
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
const source: OrdersSource = ordersMock;

export const getOrders: OrdersSource["getOrders"] = () => source.getOrders();
export const getOrder: OrdersSource["getOrder"] = (id) => source.getOrder(id);
