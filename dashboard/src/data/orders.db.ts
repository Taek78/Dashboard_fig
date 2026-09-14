import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, type DbExecutor } from "@/db/client";
import { toOrder, toOrderEvent } from "@/db/mappers";
import {
  communities,
  customers,
  orderEvents,
  orderLines,
  orders,
  staff,
} from "@/db/schema";
import type { StaffAssignment } from "@/domain/orders/assignment";
import type { OrdersSource } from "@/domain/orders/source";
import type { Order, OrderFilters, StatusChange } from "@/domain/orders/types";

/*
 * Implémentation Drizzle du contrat OrdersSource.
 * Les filtres deviennent des clauses WHERE, le tri par créneau un ORDER BY ;
 * la communauté, le préparateur et le livreur sont joints (LEFT JOIN, la table
 * staff deux fois sous alias) ; les lignes sont chargées en une seconde
 * requête (IN) puis rattachées.
 * updateOrderStatus est une mise à jour CONDITIONNELLE dans une transaction :
 * `UPDATE … WHERE id = $1 AND status = $2`, 0 ligne → null, sinon l'événement
 * d'historique est inséré dans la même transaction.
 */
const preparer = alias(staff, "preparer");
const driver = alias(staff, "driver");

async function loadOrders(
  db: DbExecutor,
  where: SQL | undefined,
): Promise<Order[]> {
  const rows = await db
    .select({
      order: orders,
      customer: customers,
      community: { id: communities.id, name: communities.name },
      preparer: {
        id: preparer.id,
        firstName: preparer.firstName,
        lastName: preparer.lastName,
      },
      driver: {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
      },
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(communities, eq(orders.communityId, communities.id))
    .leftJoin(preparer, eq(orders.preparerId, preparer.id))
    .leftJoin(driver, eq(orders.driverId, driver.id))
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
    toOrder(r.order, r.customer, byOrder.get(r.order.id) ?? [], {
      community: r.community,
      preparer: r.preparer,
      driver: r.driver,
    }),
  );
}

function whereFor(filters: OrderFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(orders.status, filters.status));
  if (filters.date) clauses.push(eq(orders.deliveryDate, filters.date));
  if (filters.customerId) {
    clauses.push(eq(orders.customerId, filters.customerId));
  }
  if (filters.communityId) {
    clauses.push(eq(orders.communityId, filters.communityId));
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

  assignStaff: async (id: string, assignment: StaffAssignment) => {
    const db = getDb();
    const column =
      assignment.role === "preparer" ? "preparerId" : ("driverId" as const);
    const updated = await db
      .update(orders)
      .set({ [column]: assignment.staff?.id ?? null })
      .where(eq(orders.id, id))
      .returning({ id: orders.id });
    if (updated.length === 0) return null;
    const [order] = await loadOrders(db, eq(orders.id, id));
    return order ?? null;
  },
};
