import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
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
import { toOrder, toOrderEvent, type OrderLineRow } from "@/db/mappers";
import {
  communities,
  customerNotifications,
  customers,
  orderEvents,
  orders,
  staff,
} from "@/db/schema";
import type { StaffAssignment } from "@/domain/orders/assignment";
import { ORDERS_PAGE_SIZE, pageWindow } from "@/domain/orders/rules";
import { FINISHED_STATUSES, ORDER_STATUSES } from "@/domain/orders/status";
import type { OrdersSource } from "@/domain/orders/source";
import type { StatusCounts } from "@/domain/metrics/rules";
import type { Order, OrderFilters, StatusChange } from "@/domain/orders/types";
import {
  containsPattern,
  digitsOnly,
  isPhoneLike,
  normalize,
} from "@/lib/text";

/*
 * Implémentation Drizzle du contrat OrdersSource (lectures et écritures des
 * commandes ; les chiffres agrégés sont dans orders-aggregates.db.ts).
 * - Filtres ET recherche libre deviennent des clauses WHERE : la base ne
 *   renvoie que les commandes utiles. La recherche lit des colonnes calculées
 *   par la base (search_text, phone_digits, migration 0006) : référence, ville
 *   et code postal normalisés côté commande (index trigramme), nom et e-mail
 *   côté client ; test/data/orders.db.test.ts la compare à matchesOrderQuery.
 * - Une commande se lit en UNE requête : client, communauté, préparateur et
 *   livreur joints (staff deux fois sous alias), lignes agrégées en JSON par une
 *   sous-requête (clé primaire order_id, position). Pour une page, les
 *   identifiants sont choisis d'abord (tri + LIMIT sur orders seule) : jointures
 *   et lignes ne sont calculées que pour les commandes affichées.
 * - getOrdersPage lit la page et le total EN PARALLÈLE (deux connexions du pool).
 * - updateOrderStatus est une mise à jour CONDITIONNELLE dans une transaction :
 *   `UPDATE … WHERE id = $1 AND status = $2`, 0 ligne → null, sinon l'événement
 *   d'historique est inséré dans la même transaction, puis la notification
 *   pour le client par un `INSERT … SELECT … WHERE notify_order_status` : le
 *   consentement est relu par la base au moment d'écrire, et rien n'est déposé
 *   pour qui ne l'a pas donné.
 * - assignStaff aussi : `UPDATE … WHERE id = $1 AND status NOT IN ('delivered',
 *   'cancelled') AND driver_id IS NOT DISTINCT FROM $2` (colonne du rôle, la
 *   personne que l'écran affichait) : une commande terminée entre la relecture
 *   et l'écriture, ou réaffectée par quelqu'un d'autre, n'est pas écrasée.
 */
const preparer = alias(staff, "preparer");
const driver = alias(staff, "driver");

/** Lignes de la commande courante, dans l'ordre, au format OrderLineRow. */
const linesJson = sql<OrderLineRow[]>`(
  select coalesce(json_agg(json_build_object(
    'orderId', l.order_id, 'position', l.position, 'productId', l.product_id,
    'productName', l.product_name, 'quantity', l.quantity, 'unit', l.unit,
    'lineTotalCents', l.line_total_cents
  ) order by l.position), '[]'::json)
  from order_lines l
  where l.order_id = ${orders.id}
)`;

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
  const slotOrder = [
    by(orders.deliveryDate),
    by(orders.deliveryStart),
    by(orders.reference),
  ];
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
      lines: linesJson,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(communities, eq(orders.communityId, communities.id))
    .leftJoin(preparer, eq(orders.preparerId, preparer.id))
    .leftJoin(driver, eq(orders.driverId, driver.id))
    .$dynamic();
  if (limit === undefined) {
    query = query.where(where);
  } else {
    const page = db
      .select({ id: orders.id })
      .from(orders)
      .where(where)
      .orderBy(...slotOrder)
      .limit(limit)
      .offset(offset)
      .as("page");
    query = query.innerJoin(page, eq(orders.id, page.id));
  }
  const rows = await query.orderBy(...slotOrder);
  return rows.map((r) =>
    toOrder(r.order, r.customer, r.lines, {
      community: r.community,
      preparer: r.preparer,
      driver: r.driver,
    }),
  );
}

async function countWhere(
  db: DbExecutor,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db.select({ total: count() }).from(orders).where(where);
  return row?.total ?? 0;
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
 * matchesOrderQuery en SQL, sur les colonnes normalisées par la base. LIKE
 * « contient » avec un motif échappé (containsPattern : « % » ou « _ » saisis
 * restent du texte). Le client est cherché par une sous-requête transformée en
 * liste (= ANY(ARRAY(…))) : PostgreSQL combine alors l'index trigramme et
 * l'index customer_id au lieu de parcourir la table.
 */
function queryClause(query: string | undefined): SQL | undefined {
  const q = normalize(query ?? "");
  if (q === "") return undefined;
  const pattern = containsPattern(q);
  const digits = digitsOnly(q);
  const customerMatch =
    isPhoneLike(q) && digits.length >= 2
      ? sql`${customers.searchText} like ${pattern} or ${customers.phoneDigits} like ${containsPattern(digits)}`
      : sql`${customers.searchText} like ${pattern}`;
  return sql`(${orders.searchText} like ${pattern} or ${orders.customerId} = any(array(select ${customers.id} from ${customers} where ${customerMatch})))`;
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
  getOrders: (filters: OrderFilters = {}, options = {}) =>
    loadOrders(getDb(), whereFor(filters), { limit: options.limit }),

  countOrders: (filters: OrderFilters) =>
    countWhere(getDb(), whereFor(filters)),

  // Un GROUP BY sur le même WHERE que la liste : la barre d'avancement de
  // /commandes résume toutes les pages, pas seulement celle affichée.
  getOrderStatusCounts: async (filters: OrderFilters) => {
    const rows = await getDb()
      .select({ status: orders.status, total: count() })
      .from(orders)
      .where(whereFor(filters))
      .groupBy(orders.status);
    const counts = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, 0]),
    ) as StatusCounts;
    for (const row of rows) counts[row.status] = row.total;
    return counts;
  },

  getOrdersPage: async (
    filters: OrderFilters,
    page: number,
    size = ORDERS_PAGE_SIZE,
  ) => {
    const db = getDb();
    const where = whereFor(filters);
    // La page demandée et le total en parallèle. Un numéro au-delà de la
    // dernière page (URL modifiée à la main) coûte une relecture, ramenée
    // dans les bornes par pageWindow.
    const asked = pageWindow(Number.MAX_SAFE_INTEGER, page, size);
    const read = (offset: number) =>
      loadOrders(db, where, { direction: "desc", limit: size, offset });
    const [total, items] = await Promise.all([
      countWhere(db, where),
      read(asked.offset),
    ]);
    const window = pageWindow(total, page, size);
    return {
      items: window.offset === asked.offset ? items : await read(window.offset),
      page: window.page,
      pageCount: window.pageCount,
      total,
    };
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

      if (change.notification) {
        // Déposée seulement si le client a autorisé les notifications d'état :
        // la condition est lue par la base dans la même transaction.
        await tx.execute(sql`
          insert into ${customerNotifications}
            (id, customer_id, order_id, kind, order_status, title, body)
          select ${randomUUID()}, o.customer_id, o.id, 'order_status',
            ${change.to}::order_status,
            ${change.notification.title}, ${change.notification.body}
          from ${orders} o
          join ${customers} c on c.id = o.customer_id
          where o.id = ${id} and c.notify_order_status
        `);
      }

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
