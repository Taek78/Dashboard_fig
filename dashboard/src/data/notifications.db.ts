import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCustomerNotification } from "@/db/mappers";
import { customerNotifications, orders } from "@/db/schema";
import type { NotificationsSource } from "@/domain/notifications/source";
import type { CustomerNotification } from "@/domain/notifications/types";
import { keysetSlice } from "@/lib/api/cursor";

/*
 * Implémentation Drizzle du contrat NotificationsSource : lectures de la file
 * customer_notifications, la référence de la commande jointe. L'écriture du
 * dépôt est dans orders.db.ts (updateOrderStatus), dans la transaction du
 * statut ; seul l'accusé d'envoi (markNotificationSent) s'écrit ici,
 * conditionnellement (`WHERE sent_at IS NULL`).
 */
const selection = {
  notification: customerNotifications,
  order: { id: orders.id, reference: orders.reference },
};

const map = (r: {
  notification: typeof customerNotifications.$inferSelect;
  order: { id: string; reference: string };
}): CustomerNotification => toCustomerNotification(r.notification, r.order);

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
    return rows.map(map);
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
    return rows.map(map);
  },

  listCustomerNotificationsPage: async (customerId, page) => {
    const after = page.after
      ? sql`(${customerNotifications.createdAt}, ${customerNotifications.id}) < (${page.after.at}::timestamptz, ${page.after.id})`
      : undefined;
    const rows = await getDb()
      .select(selection)
      .from(customerNotifications)
      .innerJoin(orders, eq(customerNotifications.orderId, orders.id))
      .where(and(eq(customerNotifications.customerId, customerId), after))
      .orderBy(
        desc(customerNotifications.createdAt),
        desc(customerNotifications.id),
      )
      .limit(page.limit + 1);
    return keysetSlice(rows.map(map), page.limit, (n) => ({
      at: n.createdAt,
      id: n.id,
    }));
  },

  // La file d'attente telle que l'index partiel customer_notifications_pending_idx la sert.
  listPendingNotifications: async (limit) => {
    const rows = await getDb()
      .select(selection)
      .from(customerNotifications)
      .innerJoin(orders, eq(customerNotifications.orderId, orders.id))
      .where(isNull(customerNotifications.sentAt))
      .orderBy(
        asc(customerNotifications.createdAt),
        asc(customerNotifications.id),
      )
      .limit(limit);
    return rows.map(map);
  },

  markNotificationSent: async (id, at) => {
    const db = getDb();
    const updated = await db
      .update(customerNotifications)
      .set({ sentAt: at })
      .where(
        and(
          eq(customerNotifications.id, id),
          isNull(customerNotifications.sentAt),
        ),
      )
      .returning({ id: customerNotifications.id });
    if (updated.length > 0) return "sent";
    const [row] = await db
      .select({ id: customerNotifications.id })
      .from(customerNotifications)
      .where(eq(customerNotifications.id, id))
      .limit(1);
    return row ? "already_sent" : "not_found";
  },
};
