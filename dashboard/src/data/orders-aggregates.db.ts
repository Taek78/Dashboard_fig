import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { CommunitySummary } from "@/domain/communities/rules";
import type { DirectoryStats } from "@/domain/customers/directory";
import type { CustomerStats } from "@/domain/customers/rules";
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
import type { OrderFilters } from "@/domain/orders/types";
import {
  summarizeStaffWork,
  type StaffWorkSummary,
} from "@/domain/staff/rules";

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
 * paramètres liés (dates, identifiants, jamais concaténés) ; la granularité
 * d'une série et les alias de table viennent de constantes du code (sql.raw),
 * jamais de l'utilisateur.
 * postgres.js renvoie les count et sum (bigint, numeric) en texte : Number().
 */
type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value ?? 0);
const day = (value: unknown) => (value === null ? null : String(value));

async function rows(query: SQL): Promise<Row[]> {
  return (await getDb().execute(query)) as unknown as Row[];
}

const inRange = (range: DateRange) =>
  sql`o.delivery_date between ${range.from} and ${range.to}`;

/** Premier jour du seau, en texte AAAA-MM-JJ ; granularités figées dans le code. */
const BUCKET_KEY: Record<Bucket, SQL> = {
  day: sql.raw(`to_char(o.delivery_date, 'YYYY-MM-DD')`),
  week: sql.raw(
    `to_char(date_trunc('week', o.delivery_date::timestamp), 'YYYY-MM-DD')`,
  ),
  month: sql.raw(
    `to_char(date_trunc('month', o.delivery_date::timestamp), 'YYYY-MM-DD')`,
  ),
};

/*
 * Compteurs du personnel : une ligne par couple (personne, commande), le
 * préparateur et le livreur s'il est une autre personne (une commande préparée
 * ET livrée par la même personne ne compte qu'une fois). Une lecture de la
 * table (ou des index préparateur et livreur pour une seule personne), sans
 * jointure « préparateur OU livreur » qui forçait une boucle imbriquée.
 */
async function staffWork(
  staffId?: string,
): Promise<Map<string, StaffWorkSummary>> {
  const onePerson =
    staffId === undefined
      ? sql.empty()
      : sql`and (o.preparer_id = ${staffId} or o.driver_id = ${staffId}) and v.staff_id = ${staffId}`;
  const found = await rows(sql`
    select
      v.staff_id as id,
      count(*) as assigned,
      count(*) filter (where o.preparer_id = v.staff_id and o.status <> 'cancelled') as prepared,
      count(*) filter (where o.driver_id = v.staff_id and o.status = 'delivered') as delivered,
      count(*) filter (where o.status in ('preparing', 'delivering')) as in_progress,
      to_char(max(o.delivery_date), 'YYYY-MM-DD') as last_activity
    from orders o
    cross join lateral (
      values (o.preparer_id),
        (case when o.driver_id is distinct from o.preparer_id then o.driver_id end)
    ) as v(staff_id)
    where v.staff_id is not null ${onePerson}
    group by v.staff_id
  `);
  return new Map(
    found.map((row) => [
      String(row.id),
      {
        assigned: num(row.assigned),
        prepared: num(row.prepared),
        delivered: num(row.delivered),
        inProgress: num(row.in_progress),
        lastActivityDate: day(row.last_activity),
      },
    ]),
  );
}

type DirectoryScope = Pick<OrderFilters, "customerId" | "communityId">;

/** Restreint l'annuaire à un client ou à une communauté (fiches) ; alias de table du code. */
function scopeOf(scope: DirectoryScope, tableAlias: "o" | "x"): SQL {
  const table = sql.raw(tableAlias);
  const clauses = [sql`true`];
  if (scope.customerId !== undefined) {
    clauses.push(sql`${table}.customer_id = ${scope.customerId}`);
  }
  if (scope.communityId !== undefined) {
    clauses.push(sql`${table}.community_id = ${scope.communityId}`);
  }
  return sql.join(clauses, sql` and `);
}

export const ordersAggregatesDb: Pick<
  OrdersSource,
  | "getOrderStats"
  | "getOrderSeries"
  | "getDeliveryDayCounts"
  | "getTopProducts"
  | "getStaffWorkSummaries"
  | "getStaffWorkSummary"
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

  getDeliveryDayCounts: async (range: DateRange) => {
    const found = await rows(sql`
      select to_char(o.delivery_date, 'YYYY-MM-DD') as day, count(*) as orders
      from orders o
      where ${inRange(range)}
      group by o.delivery_date
    `);
    return new Map(found.map((row) => [String(row.day), num(row.orders)]));
  },

  getTopProducts: async (
    range: DateRange,
    limit: number,
  ): Promise<ProductPoint[]> => {
    // Nom et unité : ceux de la première ligne vendue sur la période (instantané).
    // min() d'un tableau compare élément par élément : jour, heure, référence,
    // position (uniques ensemble), puis nom et unité qui suivent la gagnante.
    // Un agrégat par hachage, sans le tri de toutes les lignes qu'imposait
    // array_agg(… order by …).
    const found = await rows(sql`
      select
        l.product_id,
        min(array[
          to_char(o.delivery_date, 'YYYY-MM-DD'), o.delivery_start, o.reference,
          lpad(l.position::text, 6, '0'), l.product_name, l.unit::text
        ]) as first_line,
        sum(l.line_total_cents) as revenue,
        sum(l.quantity) as quantity
      from order_lines l
      join orders o on o.id = l.order_id
      where ${inRange(range)} and o.status <> 'cancelled'
      group by l.product_id
    `);
    return rankProducts(
      found.map((row) => {
        const first = row.first_line as string[];
        return {
          productId: String(row.product_id),
          productName: String(first[4]),
          unit: first[5] === "g" ? "g" : "piece",
          revenueCents: num(row.revenue),
          quantity: num(row.quantity),
        };
      }),
      limit,
    );
  },

  getStaffWorkSummaries: () => staffWork(),

  getStaffWorkSummary: async (staffId: string) =>
    (await staffWork(staffId)).get(staffId) ?? summarizeStaffWork([], staffId),

  getDirectoryStats: async (
    scope: DirectoryScope = {},
  ): Promise<DirectoryStats> => {
    const [customerRows, communityRows, streakRows] = await Promise.all([
      rows(sql`
        select
          o.customer_id as id,
          count(*) as orders,
          coalesce(sum(o.total_cents) filter (where o.status <> 'cancelled'), 0) as spent,
          to_char(max(o.delivery_date), 'YYYY-MM-DD') as last_delivery
        from orders o
        where ${scopeOf(scope, "o")}
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
        where o.community_id is not null and ${scopeOf(scope, "o")}
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
          select distinct on (x.customer_id) x.customer_id, x.created_at as at, x.id
          from orders x
          where (x.status = 'cancelled' or x.discount_kind = 'loyalty')
            and ${scopeOf(scope, "x")}
          order by x.customer_id, x.created_at desc, x.id desc
        ) r on r.customer_id = o.customer_id
        where ${scopeOf(scope, "o")}
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
