import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db/client";
import { toOrder, toOrderEvent } from "@/db/mappers";
import { customers, orderEvents, orderLines, orders } from "@/db/schema";
import type { OrdersSource } from "@/domain/orders/source";
import type { Order, OrderFilters, StatusChange } from "@/domain/orders/types";

/*
 * Implémentation Drizzle du contrat OrdersSource (piste B3, 2026-09-14).
 * Les filtres deviennent des clauses WHERE, le tri par créneau un ORDER BY ;
 * les lignes sont chargées en une seconde requête (IN) puis rattachées.
 * updateOrderStatus est une mise à jour CONDITIONNELLE dans une transaction :
 * `UPDATE … WHERE id = $1 AND status = $2`, 0 ligne → null, sinon l'événement
 * d'historique est inséré dans la même transaction.
 */
async function loadOrders(
  db: DbExecutor,
  where: SQL | undefined,
): Promise<Order[]> {
  const rows = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(
      asc(orders.deliveryDate),
      asc(orders.deliveryStart),
      asc(orders.reference),
    );
  if (rows.length === 0) return [];

  const lines = await db
    .select()
    .from(orderLines)
    .where(
      inArray(
        orderLines.orderId,
        rows.map((r) => r.order.id),
      ),
    );
  const byOrder = new Map<string, typeof lines>();
  for (const line of lines) {
    const list = byOrder.get(line.orderId) ?? [];
    list.push(line);
    byOrder.set(line.orderId, list);
  }
  return rows.map((r) =>
    toOrder(r.order, r.customer, byOrder.get(r.order.id) ?? []),
  );
}

function whereFor(filters: OrderFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(orders.status, filters.status));
  if (filters.date) clauses.push(eq(orders.deliveryDate, filters.date));
  if (filters.customerId) {
    clauses.push(eq(orders.customerId, filters.customerId));
  }
  return clauses.length === 0 ? undefined : and(...clauses);
}

export const ordersDb: OrdersSource = {
  getOrders: (filters: OrderFilters = {}) =>
    loadOrders(getDb(), whereFor(filters)),

  getOrder: async (id: string) => {
    const [order] = await loadOrders(getDb(), eq(orders.id, id));
    return order ?? null;
  },

  updateOrderStatus: (id: string, change: StatusChange) =>
    getDb().transaction(async (tx) => {
      const updated = await tx
        .update(orders)
        .set({
          status: change.to,
          cancellationReason:
            change.to === "cancelled"
              ? (change.cancellation?.reason ?? null)
              : null,
          cancellationDetail:
            change.to === "cancelled"
              ? (change.cancellation?.detail ?? null)
              : null,
        })
        .where(and(eq(orders.id, id), eq(orders.status, change.from)))
        .returning({ id: orders.id });
      if (updated.length === 0) return null;

      await tx.insert(orderEvents).values({
        id: randomUUID(),
        orderId: id,
        fromStatus: change.from,
        toStatus: change.to,
        actorId: change.actor.id,
        actorName: change.actor.name,
        cancellationReason: change.cancellation?.reason ?? null,
        cancellationDetail: change.cancellation?.detail ?? null,
      });

      const [order] = await loadOrders(tx, eq(orders.id, id));
      return order ?? null;
    }),

  getOrderEvents: async (orderId: string) => {
    const rows = await getDb()
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.at), desc(orderEvents.id));
    return rows.map(toOrderEvent);
  },
};
