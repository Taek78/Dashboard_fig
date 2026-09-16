import type { CustomerNotification } from "@/domain/notifications/types";

/*
 * CONTRAT de la file de notifications, implémenté par PostgreSQL
 * (src/data/notifications.db.ts). Lectures seulement : l'ÉCRITURE se fait dans
 * updateOrderStatus (src/data/orders.db.ts), dans la transaction du changement
 * de statut, pour qu'un statut écrit sans sa notification, ou l'inverse, soit
 * impossible.
 * - getOrderNotifications : celles d'une commande, de la plus récente à la plus
 *   ancienne (fiche commande) ;
 * - getCustomerNotifications : toutes celles d'une personne, de la plus
 *   ancienne à la plus récente (export RGPD, jamais paginé).
 */
export type NotificationsSource = {
  getOrderNotifications(orderId: string): Promise<CustomerNotification[]>;
  getCustomerNotifications(customerId: string): Promise<CustomerNotification[]>;
};
