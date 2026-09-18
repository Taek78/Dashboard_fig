import "server-only";
import { desc, eq, gt, lt, or, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerMessages, customers, orders, products } from "@/db/schema";
import type { AlertsSource } from "@/domain/alerts/source";
import { ALERT_FEED_LIMIT } from "@/domain/alerts/types";
import { LOW_STOCK_THRESHOLD } from "@/domain/products/rules";

/*
 * Implémentation Drizzle du flux des alertes. Trois lectures courtes, en
 * parallèle, relancées toutes les quelques secondes par chaque onglet ouvert :
 * - commandes : created_at > since, les plus récentes d'abord, bornées ;
 * - messages : received_at > since (index customer_messages_received_idx) ;
 * - stock : les produits sous le seuil de leur unité (même règle que
 *   isLowStock, testée contre elle), à 0 compris. Le catalogue est petit.
 * Le nom du client est lu par jointure : la notification le montre à
 * l'équipe, qui le voit déjà sur la carte.
 */
const toIso = (date: Date) => date.toISOString();

export const alertsDb: AlertsSource = {
  getAlertFeed: async (since, scope, now) => {
    const db = getDb();
    const [orderRows, messageRows, stockRows] = await Promise.all([
      scope.orders
        ? db
            .select({
              id: orders.id,
              reference: orders.reference,
              customerName: customers.fullName,
              totalCents: orders.totalCents,
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
            .innerJoin(customers, eq(customers.id, customerMessages.customerId))
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
            .where(
              or(
                and(
                  eq(products.unit, "g"),
                  lt(products.stockQuantity, LOW_STOCK_THRESHOLD.g),
                ),
                and(
                  eq(products.unit, "piece"),
                  lt(products.stockQuantity, LOW_STOCK_THRESHOLD.piece),
                ),
              ),
            )
            .orderBy(products.id)
        : [],
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
    };
  },
};
