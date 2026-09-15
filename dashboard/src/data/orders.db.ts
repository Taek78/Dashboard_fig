import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  type SQL,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
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
import { filterOrders } from "@/domain/orders/rules";
import { FINISHED_STATUSES } from "@/domain/orders/status";
import type { OrdersSource } from "@/domain/orders/source";
import type { Order, OrderFilters, StatusChange } from "@/domain/orders/types";

/*
 * Implémentation Drizzle du contrat OrdersSource.
 * Les filtres deviennent des clauses WHERE (statut, période, client,
 * communauté, équipe), le tri par créneau un ORDER BY ; la recherche libre
 * (sans accents, chiffres du téléphone) reste la règle pure du domaine,
 * appliquée après chargement : identique au mock, donc identique à l'écran ;
 * la communauté, le préparateur et le livreur sont joints (LEFT JOIN, la table
 * staff deux fois sous alias) ; les lignes sont chargées en une seconde
 * requête (IN) puis rattachées.
 * updateOrderStatus est une mise à jour CONDITIONNELLE dans une transaction :
 * `UPDATE … WHERE id = $1 AND status = $2`, 0 ligne → null, sinon l'événement
 * d'historique est inséré dans la même transaction.
 * assignStaff aussi : `UPDATE … WHERE id = $1 AND status NOT IN ('delivered',
 * 'cancelled') AND driver_id IS NOT DISTINCT FROM $2` (colonne du rôle, la
 * personne que l'écran affichait) : une commande terminée entre la relecture et
 * l'écriture, ou réaffectée par quelqu'un d'autre, n'est pas écrasée.
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

/** Filtre d'équipe : absent = pas de clause, null = IS NULL, sinon l'égalité. */
function staffClause(
  column: AnyPgColumn,
  id: string | null | undefined,
): SQL | undefined {
  if (id === undefined) return undefined;
  return id === null ? isNull(column) : eq(column, id);
}

function whereFor(filters: OrderFilters): SQL | undefined {
  const clauses = [
    filters.status ? eq(orders.status, filters.status) : undefined,
    filters.from ? gte(orders.deliveryDate, filters.from) : undefined,
    filters.to ? lte(orders.deliveryDate, filters.to) : undefined,
    filters.customerId ? eq(orders.customerId, filters.customerId) : undefined,
    filters.communityId
      ? eq(orders.communityId, filters.communityId)
      : undefined,
    staffClause(orders.preparerId, filters.preparerId),
    staffClause(orders.driverId, filters.driverId),
  ].filter((clause): clause is SQL => clause !== undefined);
  return clauses.length === 0 ? undefined : and(...clauses);
}

export const ordersDb: OrdersSource = {
  getOrders: async (filters: OrderFilters = {}) => {
    const rows = await loadOrders(getDb(), whereFor(filters));
    return filters.query === undefined
      ? rows
      : filterOrders(rows, { query: filters.query });
  },

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
    const key =
      assignment.role === "preparer" ? "preparerId" : ("driverId" as const);
    const updated = await db
      .update(orders)
      .set({ [key]: assignment.staff?.id ?? null })
      .where(
        and(
          eq(orders.id, id),
          notInArray(orders.status, [...FINISHED_STATUSES]),
          staffClause(orders[key], assignment.expectedStaffId),
        ),
      )
      .returning({ id: orders.id });
    if (updated.length === 0) return null;
    const [order] = await loadOrders(db, eq(orders.id, id));
    return order ?? null;
  },
};
