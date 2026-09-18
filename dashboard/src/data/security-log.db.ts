import "server-only";
import { and, asc, count, desc, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db/client";
import { securityEvents } from "@/db/schema";
import { pageWindow } from "@/domain/orders/rules";
import { typesOfFamily } from "@/domain/security/events";
import type {
  SecurityEventsPage,
  SecurityLogSource,
} from "@/domain/security/source";
import {
  SECURITY_PAGE_SIZE,
  type SecurityEventRecord,
  type SecurityFilters,
} from "@/domain/security/types";
import { containsPattern, normalize } from "@/lib/text";

/*
 * LECTURE du journal de sécurité. L'écriture vit dans security-log.ts et ne
 * passe pas par ici : ce module n'expose ni update ni delete, pour qu'aucun
 * écran ne puisse retoucher une preuve.
 *
 * Filtrage, recherche, comptage et découpe sont faits par la BASE, comme pour
 * les commandes et les messages. Deux index servent (migration initiale) :
 * `security_events_at_idx` pour l'ordre et la période, `security_events_type_idx`
 * pour les familles, traduites en liste de types.
 *
 * La recherche libre porte sur le type brut et les VALEURS des détails, dans
 * la même normalisation que la règle pure (fig_normalize = normalize()) : le
 * test de parité compare les deux sur les mêmes lignes. `jsonb_each_text`
 * rend exactement les valeurs, sans les clés ; une valeur nulle est ignorée
 * des deux côtés.
 */
const searchText = sql`(${securityEvents.type} || ' ' || coalesce((select string_agg(entry.value, ' ') from jsonb_each_text(${securityEvents.details}) as entry where entry.value is not null), ''))`;

/** Le jour de l'événement, à comparer aux bornes `AAAA-MM-JJ` de la période. */
const eventDay = sql`(${securityEvents.at} at time zone 'Europe/Paris')::date`;

function whereFor(filters: SecurityFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.query !== undefined) {
    const pattern = containsPattern(normalize(filters.query.trim()));
    clauses.push(sql`fig_normalize(${searchText}) like ${pattern} escape '\\'`);
  }
  if (filters.families !== undefined) {
    const types = filters.families.flatMap(typesOfFamily);
    // Aucune famille exploitable : ne rien renvoyer plutôt que tout renvoyer.
    clauses.push(
      types.length === 0 ? sql`false` : inArray(securityEvents.type, types),
    );
  }
  if (filters.from !== undefined) {
    clauses.push(sql`${eventDay} >= ${filters.from}::date`);
  }
  if (filters.to !== undefined) {
    clauses.push(sql`${eventDay} <= ${filters.to}::date`);
  }
  return clauses.length === 0 ? undefined : and(...clauses);
}

function toRecord(row: {
  id: string;
  at: Date;
  type: string;
  details: Record<string, unknown>;
}): SecurityEventRecord {
  return {
    id: row.id,
    at: row.at.toISOString(),
    type: row.type,
    details: row.details,
  };
}

async function countWhere(db: DbExecutor, where: SQL | undefined) {
  const [row] = await db
    .select({ total: count() })
    .from(securityEvents)
    .where(where);
  return row?.total ?? 0;
}

function read(
  db: DbExecutor,
  where: SQL | undefined,
  limit: number,
  offset: number,
) {
  return (
    db
      .select()
      .from(securityEvents)
      .where(where)
      // Le plus récent en tête ; l'identifiant départage deux écritures du même
      // instant, pour que deux lectures de la même page donnent le même ordre.
      .orderBy(desc(securityEvents.at), desc(securityEvents.id))
      .limit(limit)
      .offset(offset)
  );
}

export const securityLogDb: SecurityLogSource = {
  getSecurityEventsPage: async (
    filters: SecurityFilters,
    page: number,
    size = SECURITY_PAGE_SIZE,
  ): Promise<SecurityEventsPage> => {
    const db = getDb();
    const where = whereFor(filters);
    const asked = pageWindow(Number.MAX_SAFE_INTEGER, page, size);
    const [total, rows] = await Promise.all([
      countWhere(db, where),
      read(db, where, size, asked.offset),
    ]);
    const window = pageWindow(total, page, size);
    const items =
      window.offset === asked.offset
        ? rows
        : await read(db, where, size, window.offset);
    return {
      items: items.map(toRecord),
      page: window.page,
      pageCount: window.pageCount,
      total,
    };
  },

  countSecurityEvents: (filters: SecurityFilters) =>
    countWhere(getDb(), whereFor(filters)),

  oldestSecurityEventAt: async () => {
    // Le plus ancien, par l'index de date : moins coûteux qu'un min() calculé.
    const [row] = await getDb()
      .select({ at: securityEvents.at })
      .from(securityEvents)
      .orderBy(asc(securityEvents.at))
      .limit(1);
    return row?.at.toISOString() ?? null;
  },
};
