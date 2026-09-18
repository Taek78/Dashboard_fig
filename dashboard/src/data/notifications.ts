import "server-only";
import { notificationsDb } from "@/data/notifications.db";
import type { NotificationsSource } from "@/domain/notifications/source";

/*
 * FAÇADE de la file de notifications : le seul module que le front et l'API
 * importent. Le dépôt se fait par updateOrderStatus (data/orders.ts) ; l'API
 * lit « mes notifications », sert la file au serveur de l'application et
 * enregistre son accusé d'envoi ou son échec ; le back-office suit l'envoi
 * et remet en file (« Réessayer »).
 */
export const {
  getOrderNotifications,
  getCustomerNotifications,
  listCustomerNotificationsPage,
  listPendingNotifications,
  markNotificationSent,
  getNotificationDelivery,
  markNotificationFailed,
  requeueNotification,
}: NotificationsSource = notificationsDb;
