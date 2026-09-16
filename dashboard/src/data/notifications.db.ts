import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCustomerNotification } from "@/db/mappers";
import { customerNotifications, orders } from "@/db/schema";
import type { NotificationsSource } from "@/domain/notifications/source";

/*
 * Implémentation Drizzle du contrat NotificationsSource : lectures de la file
 * customer_notifications, la référence de la commande jointe. L'écriture est
 * dans orders.db.ts (updateOrderStatus), dans la transaction du statut.
 */
const selection = {
  notification: customerNotifications,
  order: { id: orders.id, reference: orders.reference },
};

export const notificationsDb: NotificationsSource = {
  getOrderNotifications: async (orderId: string) => {
    const rows = await getDb()
      .select(selection)
      .from(customerNotifications)
      .innerJoin(orders, eq(customerNotifications.orderId, orders.id))
      .where(eq(customerNotifications.orderId, orderId))
      .orderBy(
        desc(customerNotifications.createdAt),
        desc(customerNotifications.id),
      );
    return rows.map((r) => toCustomerNotification(r.notification, r.order));
  },

  getCustomerNotifications: async (customerId: string) => {
    const rows = await getDb()
      .select(selection)
      .from(customerNotifications)
      .innerJoin(orders, eq(customerNotifications.orderId, orders.id))
      .where(eq(customerNotifications.customerId, customerId))
      .orderBy(
        asc(customerNotifications.createdAt),
        asc(customerNotifications.id),
      );
    return rows.map((r) => toCustomerNotification(r.notification, r.order));
  },
};
