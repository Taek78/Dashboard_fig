import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCustomerNotification } from "@/db/mappers";
import { customerNotifications, orders } from "@/db/schema";
import type { NotificationsSource } from "@/domain/notifications/source";
import type { CustomerNotification } from "@/domain/notifications/types";
import { deliveryState } from "@/domain/notifications/delivery";
import { keysetSlice } from "@/lib/api/cursor";

/*
 * Implémentation Drizzle du contrat NotificationsSource : lectures de la file
 * customer_notifications, la référence de la commande jointe. L'écriture du
 * dépôt est dans orders.db.ts (updateOrderStatus), dans la transaction du
 * statut ; seuls l'accusé d'envoi (markNotificationSent), l'échec déclaré
 * (markNotificationFailed) et la remise en file (requeueNotification)
 * s'écrivent ici, conditionnellement (`WHERE sent_at IS NULL`).
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
      .where(
        and(
          isNull(customerNotifications.sentAt),
          isNull(customerNotifications.failedAt),
        ),
      )
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
      .set({ sentAt: at, failedAt: null, failureReason: null })
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

  getNotificationDelivery: async (id) => {
    const [row] = await getDb()
      .select({
        id: customerNotifications.id,
        orderId: customerNotifications.orderId,
        sentAt: customerNotifications.sentAt,
        failedAt: customerNotifications.failedAt,
        failureReason: customerNotifications.failureReason,
      })
      .from(customerNotifications)
      .where(eq(customerNotifications.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.orderId,
      state: deliveryState({
        sentAt: row.sentAt?.toISOString() ?? null,
        failedAt: row.failedAt?.toISOString() ?? null,
      }),
      failureReason: row.failureReason,
    };
  },

  // Échec déclaré par l'application : seulement pour une notification ni
  // envoyée ni déjà en échec (écriture conditionnelle), puis relecture pour
  // dire pourquoi rien n'a été écrit.
  markNotificationFailed: async (id, at, reason) => {
    const db = getDb();
    const updated = await db
      .update(customerNotifications)
      .set({ failedAt: at, failureReason: reason })
      .where(
        and(
          eq(customerNotifications.id, id),
          isNull(customerNotifications.sentAt),
          isNull(customerNotifications.failedAt),
        ),
      )
      .returning({ id: customerNotifications.id });
    if (updated.length > 0) return "failed";
    const [row] = await db
      .select({ sentAt: customerNotifications.sentAt })
      .from(customerNotifications)
      .where(eq(customerNotifications.id, id))
      .limit(1);
    if (!row) return "not_found";
    return row.sentAt ? "already_sent" : "already_failed";
  },

  // « Réessayer » : l'échec est effacé, la notification revient dans la file.
  requeueNotification: async (id) => {
    const db = getDb();
    const updated = await db
      .update(customerNotifications)
      .set({ failedAt: null, failureReason: null })
      .where(
        and(
          eq(customerNotifications.id, id),
          isNull(customerNotifications.sentAt),
        ),
      )
      .returning({ id: customerNotifications.id });
    if (updated.length > 0) return "queued";
    const [row] = await db
      .select({ id: customerNotifications.id })
      .from(customerNotifications)
      .where(eq(customerNotifications.id, id))
      .limit(1);
    return row ? "already_sent" : "not_found";
  },
};
