import type { OrderStatus } from "@/domain/orders/status";
import type { Order, OrderFilters } from "@/domain/orders/types";

/*
 * CONTRAT que toute source de commandes doit respecter : le mock aujourd'hui
 * (src/data/orders.mock.ts), Drizzle demain (src/data/orders.db.ts).
 *
 * Pourquoi le contrat vit dans src/domain et pas dans src/data : le domaine déclare
 * ce dont le front a besoin, src/data l'implémente. Cela évite aussi un import
 * circulaire entre la façade et ses implémentations.
 *
 * Ce fichier ne contient que des types, jamais de fonction : ajouter une méthode
 * ici casse immédiatement toute implémentation incomplète, au bon endroit.
 *
 * Choix : async dès maintenant (la vraie base le sera, on évite d'ajouter des await
 * partout plus tard) ; `null` pour « introuvable » (cas métier normal, pas une
 * panne, et `strict` force l'appelant à le traiter, ce qu'un throw ne fait pas).
 */
export type OrdersSource = {
  getOrders(filters?: OrderFilters): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<Order | null>;
};
