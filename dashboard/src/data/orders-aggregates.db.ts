import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { DirectoryStats } from "@/domain/customers/directory";
import {
  fillSeries,
  rankProducts,
  statsFromTotals,
  type Bucket,
  type BucketTotals,
  type DateRange,
  type OrderStats,
  type ProductPoint,
  type SeriesPoint,
} from "@/domain/metrics/rules";
import type { OrdersSource } from "@/domain/orders/source";
import type { CustomerStats } from "@/domain/customers/rules";
import type { CommunitySummary } from "@/domain/communities/rules";
import type { StaffWorkSummary } from "@/domain/staff/rules";

/*
 * Chiffres AGRÉGÉS par PostgreSQL : au lieu de charger toutes les commandes et
 * leurs lignes pour les compter en mémoire, chaque écran demande seulement ses
 * totaux (quelques lignes). Le calcul final (moyennes arrondies, seaux vides,
 * classement) reste celui des règles pures du domaine : statsFromTotals,
 * fillSeries, rankProducts, loyaltyFromStreak. test/data/orders.db.test.ts
 * compare chaque requête à la règle pure appliquée à toutes les commandes.
 *
 * SQL écrit à la main (sql``) : les agrégats filtrés (`count(*) filter (where …)`)
 * se lisent mieux qu'en constructeur. Les seules valeurs variables sont des
 * paramètres liés (dates, jamais concaténées) ; la granularité d'une série vient
 * d'une table fixe du code (TRUNC), jamais de l'utilisateur.
 * postgres.js renvoie les count et sum (bigint, numeric) en texte : Number().
 */
type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value ?? 0);
const day = (value: unknown) => (value === null ? null : String(value));

async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  return (await getDb().execute(query)) as unknown as Row[];
}

const inRange = (range: DateRange) =>
  sql`o.delivery_date between ${range.from} and ${range.to}`;

/** Premier jour du seau, en texte AAAA-MM-JJ ; granularités figées dans le code. */
const BUCKET_KEY: Record<Bucket, ReturnType<typeof sql>> = {
  day: sql.raw(`to_char(o.delivery_date, 'YYYY-MM-DD')`),
  week: sql.raw(
    `to_char(date_trunc('week', o.delivery_date::timestamp), 'YYYY-MM-DD')`,
  ),
  month: sql.raw(
    `to_char(date_trunc('month', o.delivery_date::timestamp), 'YYYY-MM-DD')`,
  ),
};

export const ordersAggregatesDb: Pick<
  OrdersSource,
  | "getOrderStats"
  | "getOrderSeries"
  | "getTopProducts"
  | "getStaffWorkSummaries"
  | "getDirectoryStats"
> = {
  getOrderStats: async (range: DateRange): Promise<OrderStats> => {
    const [row = {}] = await rows(sql`
      select
        count(*) filter (where o.status = 'preparing') as preparing,
        count(*) filter (where o.status = 'delivering') as delivering,
        count(*) filter (where o.status = 'delivered') as delivered,
        count(*) filter (where o.status = 'cancelled') as cancelled,
        coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0) as revenue,
        count(*) filter (where o.community_id is not null) as community,
        count(distinct o.customer_id) filter (where o.status <> 'cancelled') as buyers
      from orders o
      where ${inRange(range)}
    `);
    return statsFromTotals({
      statusCounts: {
        preparing: num(row.preparing),
        delivering: num(row.delivering),
        delivered: num(row.delivered),
        cancelled: num(row.cancelled),
      },
      revenueCents: num(row.revenue),
      communityCount: num(row.community),
      buyers: num(row.buyers),
    });
  },

  getOrderSeries: async (
    range: DateRange,
    bucket: Bucket,
  ): Promise<SeriesPoint[]> => {
    const found = await rows(sql`
      select
        ${BUCKET_KEY[bucket]} as key,
        count(*) as orders,
        count(*) filter (where o.status = 'cancelled') as cancelled,
        coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0) as revenue,
        count(distinct o.customer_id) filter (where o.status <> 'cancelled') as buyers
      from orders o
      where ${inRange(range)}
      group by 1
    `);
    const totals: BucketTotals[] = found.map((row) => ({
      key: String(row.key),
      orderCount: num(row.orders),
      cancelledCount: num(row.cancelled),
      revenueCents: num(row.revenue),
      buyers: num(row.buyers),
    }));
    return fillSeries(range, bucket, totals);
  },

  getTopProducts: async (
    range: DateRange,
    limit: number,
  ): Promise<ProductPoint[]> => {
    // Nom et unité : ceux de la première ligne vendue sur la période (instantané).
    const found = await rows(sql`
      select
        l.product_id,
        (array_agg(l.product_name order by o.delivery_date, o.delivery_start, o.reference, l.position))[1] as product_name,
        (array_agg(l.unit::text order by o.delivery_date, o.delivery_start, o.reference, l.position))[1] as unit,
        sum(l.line_total_cents) as revenue,
        sum(l.quantity) as quantity
      from order_lines l
      join orders o on o.id = l.order_id
      where ${inRange(range)} and o.status <> 'cancelled'
      group by l.product_id
    `);
    return rankProducts(
      found.map((row) => ({
        productId: String(row.product_id),
        productName: String(row.product_name),
        unit: row.unit === "g" ? "g" : "piece",
        revenueCents: num(row.revenue),
        quantity: num(row.quantity),
      })),
      limit,
    );
  },

  getStaffWorkSummaries: async () => {
    // Une ligne par couple (personne, commande) : une commande préparée ET livrée
    // par la même personne ne compte qu'une fois dans « en cours ».
    const found = await rows(sql`
      select
        s.id,
        count(*) filter (where o.preparer_id = s.id and o.status <> 'cancelled') as prepared,
        count(*) filter (where o.driver_id = s.id and o.status = 'delivered') as delivered,
        count(*) filter (where o.status in ('preparing', 'delivering')) as in_progress,
        to_char(max(o.delivery_date), 'YYYY-MM-DD') as last_activity
      from staff s
      join orders o on o.preparer_id = s.id or o.driver_id = s.id
      group by s.id
    `);
    return new Map<string, StaffWorkSummary>(
      found.map((row) => [
        String(row.id),
        {
          prepared: num(row.prepared),
          delivered: num(row.delivered),
          inProgress: num(row.in_progress),
          lastActivityDate: day(row.last_activity),
        },
      ]),
    );
  },

  getDirectoryStats: async (): Promise<DirectoryStats> => {
    const [customerRows, communityRows, streakRows] = await Promise.all([
      rows(sql`
        select
          o.customer_id as id,
          count(*) as orders,
          coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0) as spent,
          to_char(max(o.delivery_date), 'YYYY-MM-DD') as last_delivery
        from orders o
        group by o.customer_id
      `),
      rows(sql`
        select
          o.community_id as id,
          count(*) as orders,
          coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0) as total,
          coalesce(sum(o.discount_cents) filter (where o.status <> 'cancelled'), 0) as discount,
          to_char(max(o.delivery_date), 'YYYY-MM-DD') as last_delivery
        from orders o
        where o.community_id is not null
        group by o.community_id
      `),
      // Série de fidélité : commandes passées après la dernière remise à zéro
      // (annulation ou remise fidélité), dans l'ordre (created_at, id).
      rows(sql`
        select o.customer_id as id,
          count(*) filter (
            where r.at is null or (o.created_at, o.id) > (r.at, r.id)
          ) as streak
        from orders o
        left join (
          select distinct on (customer_id) customer_id, created_at as at, id
          from orders
          where status = 'cancelled' or discount_kind = 'loyalty'
          order by customer_id, created_at desc, id desc
        ) r on r.customer_id = o.customer_id
        group by o.customer_id
      `),
    ]);
    return {
      customers: new Map<string, CustomerStats>(
        customerRows.map((row) => [
          String(row.id),
          {
            orderCount: num(row.orders),
            totalSpentCents: num(row.spent),
            lastDeliveryDate: day(row.last_delivery),
          },
        ]),
      ),
      communities: new Map<string, CommunitySummary>(
        communityRows.map((row) => [
          String(row.id),
          {
            orderCount: num(row.orders),
            totalCents: num(row.total),
            discountCents: num(row.discount),
            lastDeliveryDate: day(row.last_delivery),
          },
        ]),
      ),
      loyaltyStreaks: new Map(
        streakRows.map((row) => [String(row.id), num(row.streak)]),
      ),
    };
  },
};
