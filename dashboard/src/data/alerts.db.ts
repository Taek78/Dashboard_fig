import "server-only";
import { and, count, desc, eq, gt, lt, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerMessages,
  customers,
  orders,
  products,
  users,
} from "@/db/schema";
import type { AlertsSource } from "@/domain/alerts/source";
import {
  ALERT_FEED_LIMIT,
  DEFAULT_ALERT_PREFS,
  type AlertReadKind,
  type UnreadCounts,
} from "@/domain/alerts/types";
import { LOW_STOCK_THRESHOLD } from "@/domain/products/rules";

/*
 * Implémentation Drizzle du flux des alertes. Trois lectures courtes, en
 * parallèle, relancées toutes les quelques secondes par chaque onglet ouvert :
 * - commandes : created_at > since, les plus récentes d'abord, bornées ;
 * - messages : received_at > since (index customer_messages_received_idx) ;
 * - stock : les produits sous le seuil de leur unité (même règle que
 *   isLowStock, testée contre elle), à 0 compris. Le catalogue est petit.
 * Compteurs non lus : trois COUNT depuis les dernières visites du compte
 * (users.*_seen_at), le stock sur la date de modification du produit.
 * Le nom du client est lu par jointure : la notification le montre à
 * l'équipe, qui le voit déjà sur la carte.
 */
const toIso = (date: Date) => date.toISOString();

/** Sous le seuil de son unité, à 0 compris : la règle isLowStock en SQL. */
const underThreshold: SQL = or(
  and(
    eq(products.unit, "g"),
    lt(products.stockQuantity, LOW_STOCK_THRESHOLD.g),
  ),
  and(
    eq(products.unit, "piece"),
    lt(products.stockQuantity, LOW_STOCK_THRESHOLD.piece),
  ),
)!;

/** Colonne de la dernière visite de chaque fil. */
const SEEN_FIELD = {
  orders: "ordersSeenAt",
  messages: "messagesSeenAt",
  stock: "stockSeenAt",
} as const satisfies Record<AlertReadKind, keyof typeof users.$inferSelect>;

const NONE: UnreadCounts = { orders: 0, messages: 0, stock: 0 };

/** Compteurs non lus d'un compte : trois COUNT depuis ses dernières visites. */
async function unreadFor(
  userId: string,
  scope: { orders: boolean; messages: boolean; stock: boolean },
): Promise<UnreadCounts> {
  const db = getDb();
  const [seen] = await db
    .select({
      orders: users.ordersSeenAt,
      messages: users.messagesSeenAt,
      stock: users.stockSeenAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!seen) return NONE;
  const total = async (query: Promise<{ total: number }[]>) =>
    (await query)[0]?.total ?? 0;
  const [ordersCount, messagesCount, stockCount] = await Promise.all([
    scope.orders
      ? total(
          db
            .select({ total: count() })
            .from(orders)
            .where(gt(orders.createdAt, seen.orders)),
        )
      : 0,
    scope.messages
      ? total(
          db
            .select({ total: count() })
            .from(customerMessages)
            .where(gt(customerMessages.receivedAt, seen.messages)),
        )
      : 0,
    scope.stock
      ? total(
          db
            .select({ total: count() })
            .from(products)
            .where(and(underThreshold, gt(products.updatedAt, seen.stock))),
        )
      : 0,
  ]);
  return { orders: ordersCount, messages: messagesCount, stock: stockCount };
}

export const alertsDb: AlertsSource = {
  getAlertFeed: async (since, scope, now, userId) => {
    const db = getDb();
    const [orderRows, messageRows, stockRows, unread, prefs] =
      await Promise.all([
        scope.orders
          ? db
              .select({
                id: orders.id,
                customerName: customers.fullName,
                totalCents: orders.totalCents,
                addressLine: orders.deliveryAddressLine,
                postalCode: orders.deliveryPostalCode,
                city: orders.deliveryCity,
                createdAt: orders.createdAt,
              })
              .from(orders)
              .innerJoin(customers, eq(customers.id, orders.customerId))
              .where(gt(orders.createdAt, since))
              .orderBy(desc(orders.createdAt), desc(orders.id))
              .limit(ALERT_FEED_LIMIT)
          : [],
        scope.messages
          ? db
              .select({
                id: customerMessages.id,
                subject: customerMessages.subject,
                customerName: customers.fullName,
                receivedAt: customerMessages.receivedAt,
              })
              .from(customerMessages)
              .innerJoin(
                customers,
                eq(customers.id, customerMessages.customerId),
              )
              .where(gt(customerMessages.receivedAt, since))
              .orderBy(
                desc(customerMessages.receivedAt),
                desc(customerMessages.id),
              )
              .limit(ALERT_FEED_LIMIT)
          : [],
        scope.stock
          ? db
              .select({
                id: products.id,
                name: products.name,
                unit: products.unit,
                stockQuantity: products.stockQuantity,
              })
              .from(products)
              .where(underThreshold)
              .orderBy(products.id)
          : [],
        unreadFor(userId, scope),
        alertsDb.getAlertPrefs(userId),
      ]);
    return {
      now: toIso(now),
      orders: orderRows.map((row) => ({
        ...row,
        createdAt: toIso(row.createdAt),
      })),
      messages: messageRows.map((row) => ({
        ...row,
        receivedAt: toIso(row.receivedAt),
      })),
      stock: stockRows,
      unread,
      prefs,
    };
  },

  getAlertPrefs: async (userId) => {
    const [row] = await getDb()
      .select({
        orders: users.notifyOrders,
        messages: users.notifyMessages,
        muted: users.alertSoundMuted,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? DEFAULT_ALERT_PREFS;
  },

  setAlertPrefs: async (userId, prefs) => {
    await getDb()
      .update(users)
      .set({
        notifyOrders: prefs.orders,
        notifyMessages: prefs.messages,
        // Plus aucune notification : plus de son à couper, la case retombe.
        alertSoundMuted: prefs.muted && (prefs.orders || prefs.messages),
      })
      .where(eq(users.id, userId));
  },

  // Jamais en arrière : une requête lente ne rallume pas un compteur remis à zéro.
  markAlertsSeen: async (userId, kind, at) => {
    const field = SEEN_FIELD[kind];
    await getDb()
      .update(users)
      .set({ [field]: at })
      .where(and(eq(users.id, userId), lt(users[field], at)));
  },
};
