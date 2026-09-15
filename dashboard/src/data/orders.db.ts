import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { ordersAggregatesDb } from "@/data/orders-aggregates.db";
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
import { ORDERS_PAGE_SIZE, pageWindow } from "@/domain/orders/rules";
import { FINISHED_STATUSES } from "@/domain/orders/status";
import type { OrdersSource } from "@/domain/orders/source";
import type { Order, OrderFilters, StatusChange } from "@/domain/orders/types";
import { digitsOnly, isPhoneLike, normalize } from "@/lib/text";

/*
 * Implémentation Drizzle du contrat OrdersSource (lectures et écritures des
 * commandes ; les chiffres agrégés sont dans orders-aggregates.db.ts).
 * - Filtres ET recherche libre deviennent des clauses WHERE : la base ne
 *   renvoie que les commandes utiles, et getOrdersPage découpe la page (LIMIT,
 *   OFFSET) après un COUNT. La recherche reproduit la règle pure
 *   matchesOrderQuery (référence, nom, e-mail, ville, code postal sans accents
 *   ni majuscules ; téléphone chiffres seuls quand la saisie ressemble à un
 *   numéro) ; test/data/orders.db.test.ts compare les deux.
 * - La communauté, le préparateur et le livreur sont joints (LEFT JOIN, la table
 *   staff deux fois sous alias) ; les lignes sont chargées en une seconde
 *   requête (IN) puis rattachées.
 * - updateOrderStatus est une mise à jour CONDITIONNELLE dans une transaction :
 *   `UPDATE … WHERE id = $1 AND status = $2`, 0 ligne → null, sinon l'événement
 *   d'historique est inséré dans la même transaction.
 * - assignStaff aussi : `UPDATE … WHERE id = $1 AND status NOT IN ('delivered',
 *   'cancelled') AND driver_id IS NOT DISTINCT FROM $2` (colonne du rôle, la
 *   personne que l'écran affichait) : une commande terminée entre la relecture
 *   et l'écriture, ou réaffectée par quelqu'un d'autre, n'est pas écrasée.
 */
const preparer = alias(staff, "preparer");
const driver = alias(staff, "driver");

type LoadOptions = {
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

async function loadOrders(
  db: DbExecutor,
  where: SQL | undefined,
  { direction = "asc", limit, offset = 0 }: LoadOptions = {},
): Promise<Order[]> {
  const by = direction === "desc" ? desc : asc;
  let query = db
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
      by(orders.deliveryDate),
      by(orders.deliveryStart),
      by(orders.reference),
    )
    .$dynamic();
  if (limit !== undefined) query = query.limit(limit).offset(offset);
  const rows = await query;
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

/*
 * normalize() de src/lib/text.ts en SQL : ligatures œ et æ dépliées, lettres
 * accentuées françaises ramenées à leur base, minuscules. Les deux alphabets
 * ont la même longueur (translate remplace caractère pour caractère).
 */
const ACCENTED = "ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ";
const PLAIN = "AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy";

function normalized(column: AnyPgColumn): SQL {
  return sql`lower(translate(replace(replace(replace(replace(${column}, 'œ', 'oe'), 'Œ', 'OE'), 'æ', 'ae'), 'Æ', 'AE'), ${ACCENTED}, ${PLAIN}))`;
}

/** matchesOrderQuery en SQL ; strpos plutôt que LIKE : « % » ou « _ » saisis restent du texte. */
function queryClause(query: string | undefined): SQL | undefined {
  const q = normalize(query ?? "");
  if (q === "") return undefined;
  const fields = [
    orders.reference,
    customers.fullName,
    customers.email,
    orders.deliveryCity,
    orders.deliveryPostalCode,
  ];
  const clauses = fields.map(
    (field) => sql`strpos(${normalized(field)}, ${q}) > 0`,
  );
  const digits = digitsOnly(q);
  if (isPhoneLike(q) && digits.length >= 2) {
    clauses.push(
      sql`strpos(regexp_replace(${customers.phone}, '[^0-9]', '', 'g'), ${digits}) > 0`,
    );
  }
  return or(...clauses);
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
    filters.staffId
      ? or(
          eq(orders.preparerId, filters.staffId),
          eq(orders.driverId, filters.staffId),
        )
      : undefined,
    staffClause(orders.preparerId, filters.preparerId),
    staffClause(orders.driverId, filters.driverId),
    queryClause(filters.query),
  ].filter((clause): clause is SQL => clause !== undefined);
  return clauses.length === 0 ? undefined : and(...clauses);
}

const records: Omit<OrdersSource, keyof typeof ordersAggregatesDb> = {
  getOrders: (filters: OrderFilters = {}) =>
    loadOrders(getDb(), whereFor(filters)),

  getOrdersPage: async (
    filters: OrderFilters,
    page: number,
    size = ORDERS_PAGE_SIZE,
  ) => {
    const db = getDb();
    const where = whereFor(filters);
    const [row] = await db
      .select({ total: count() })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(where);
    const total = row?.total ?? 0;
    const window = pageWindow(total, page, size);
    const items =
      total === 0
        ? []
        : await loadOrders(db, where, {
            direction: "desc",
            limit: size,
            offset: window.offset,
          });
    return { items, page: window.page, pageCount: window.pageCount, total };
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

export const ordersDb: OrdersSource = { ...records, ...ordersAggregatesDb };
