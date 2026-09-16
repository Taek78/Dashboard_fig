import "server-only";
import { notificationsDb } from "@/data/notifications.db";
import type { NotificationsSource } from "@/domain/notifications/source";

/*
 * FAÇADE de la file de notifications : le seul module que le front importe.
 * Lectures seulement ; le dépôt se fait par updateOrderStatus (data/orders.ts).
 */
export const {
  getOrderNotifications,
  getCustomerNotifications,
}: NotificationsSource = notificationsDb;
