import "server-only";
import { selectSource } from "@/data/select-source";
import type { OrdersSource } from "@/domain/orders/source";
import { ordersDb } from "@/data/orders.db";
import { ordersMock } from "@/data/orders.mock";

/*
 * FAÇADE des commandes : le seul module que le front (pages, Server Actions)
 * importe pour lire ou écrire des commandes.
 *
 * - `source` n'est pas exporté : le reste de l'app ne voit que des fonctions
 *   typées par le contrat OrdersSource. Ce qui n'est pas dans le contrat
 *   (resetOrdersMock, le pool Postgres) reste inaccessible.
 * - selectSource choisit l'implémentation selon DATA_SOURCE : fixtures en
 *   mémoire (orders.mock.ts) ou PostgreSQL (orders.db.ts). Les pages ne savent
 *   pas laquelle est active.
 * - `import "server-only"` : Next fait échouer le build si un composant client
 *   importe ce module. Les tests importent le mock ou src/domain, jamais ceci.
 */
const source: OrdersSource = selectSource("commandes", ordersMock, ordersDb);

export const getOrders: OrdersSource["getOrders"] = (filters) =>
  source.getOrders(filters);
export const getOrder: OrdersSource["getOrder"] = (id) => source.getOrder(id);
/** Écriture conditionnelle (statut relu) qui ajoute aussi l'événement d'historique. */
export const updateOrderStatus: OrdersSource["updateOrderStatus"] = (
  id,
  change,
) => source.updateOrderStatus(id, change);
/** Historique des changements de statut, du plus récent au plus ancien. */
export const getOrderEvents: OrdersSource["getOrderEvents"] = (orderId) =>
  source.getOrderEvents(orderId);
/** Pose ou retire le préparateur ou le livreur (personne déjà vérifiée par l'action). */
export const assignStaff: OrdersSource["assignStaff"] = (id, assignment) =>
  source.assignStaff(id, assignment);
