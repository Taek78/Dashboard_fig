import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db/client";
import { toMessage, type MessageAttachmentRow } from "@/db/mappers";
import {
  customerMessages,
  customers,
  messageAttachments,
  orders,
} from "@/db/schema";
import { MESSAGES_PAGE_SIZE } from "@/domain/messages/rules";
import type { MessagesSource } from "@/domain/messages/source";
import type {
  Message,
  MessageFilters,
  MessageImportantChange,
  MessagePinChange,
  MessageStatusChange,
} from "@/domain/messages/types";
import { pageWindow } from "@/domain/orders/rules";
import { containsPattern, normalize } from "@/lib/text";

/*
 * Implémentation Drizzle du contrat MessagesSource.
 *
 * - Un message se lit en UNE requête : auteur et commande citée joints, pièces
 *   jointes agrégées en JSON par une sous-requête (ordonnées par position).
 *   Pour une page, les identifiants sont choisis d'abord (tri + LIMIT sur la
 *   seule table customer_messages) : jointures et pièces jointes ne sont
 *   calculées que pour les messages affichés.
 * - Les clauses WHERE sont AUTOPORTANTES (sous-requêtes plutôt qu'appui sur les
 *   jointures) : la même clause sert au COUNT, au choix des identifiants de la
 *   page et à la lecture complète.
 * - La recherche reproduit matchesMessageQuery sur des colonnes normalisées par
 *   la base (fig_normalize, migration 0006) ; test/data/messages.db.test.ts la
 *   compare à la règle pure. Pas d'index trigramme ici : une boîte de réception
 *   de support reste petite devant la table des commandes ; à ajouter si elle
 *   grossit (même recette que la migration 0006).
 * - Les trois écritures sont CONDITIONNELLES : `WHERE id = $1 AND <état relu>`.
 *   Zéro ligne modifiée → null, et l'action dit « modifié entre-temps » au lieu
 *   d'écraser le geste d'un collègue.
 */

/** Pièces jointes du message courant, dans l'ordre, au format MessageAttachmentRow. */
const attachmentsJson = sql<MessageAttachmentRow[]>`(
  select coalesce(json_agg(json_build_object(
    'id', a.id, 'messageId', a.message_id, 'position', a.position,
    'fileName', a.file_name, 'contentType', a.content_type,
    'sizeBytes', a.size_bytes, 'url', a.url
  ) order by a.position), '[]'::json)
  from ${messageAttachments} a
  where a.message_id = ${customerMessages.id}
)`;

/*
 * Ordre de la boîte de réception, identique à sortMessages : les épinglés
 * d'abord (`pinned_at is null` vaut false pour eux, et false trie avant true),
 * le plus récemment épinglé en tête, puis les autres du plus récent au plus
 * ancien, l'identifiant départageant les ex æquo.
 */
const listOrder = [
  sql`${customerMessages.pinnedAt} is null`,
  desc(customerMessages.pinnedAt),
  desc(customerMessages.receivedAt),
  asc(customerMessages.id),
];

async function loadMessages(
  db: DbExecutor,
  where: SQL | undefined,
  { limit, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Message[]> {
  let query = db
    .select({
      message: customerMessages,
      customer: {
        id: customers.id,
        fullName: customers.fullName,
        email: customers.email,
      },
      order: { id: orders.id, reference: orders.reference },
      attachments: attachmentsJson,
    })
    .from(customerMessages)
    .innerJoin(customers, eq(customerMessages.customerId, customers.id))
    .leftJoin(orders, eq(customerMessages.orderId, orders.id))
    .$dynamic();
  if (limit === undefined) {
    query = query.where(where);
  } else {
    const page = db
      .select({ id: customerMessages.id })
      .from(customerMessages)
      .where(where)
      .orderBy(...listOrder)
      .limit(limit)
      .offset(offset)
      .as("page");
    query = query.innerJoin(page, eq(customerMessages.id, page.id));
  }
  const rows = await query.orderBy(...listOrder);
  return rows.map((r) =>
    toMessage(r.message, r.attachments, {
      customer: r.customer,
      order: r.order,
    }),
  );
}

async function countWhere(
  db: DbExecutor,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(customerMessages)
    .where(where);
  return row?.total ?? 0;
}

/**
 * matchesMessageQuery en SQL. Le corps est cherché sur la colonne calculée du
 * message ; l'auteur et la référence de la commande par des sous-requêtes
 * transformées en listes (= ANY(ARRAY(…))), pour que la clause reste utilisable
 * sans jointure. Motif LIKE échappé : « 100% » cherche vraiment « 100% ».
 */
function queryClause(query: string | undefined): SQL | undefined {
  const q = normalize(query ?? "");
  if (q === "") return undefined;
  const pattern = containsPattern(q);
  return sql`(${customerMessages.searchText} like ${pattern}
    or ${customerMessages.customerId} = any(array(
      select ${customers.id} from ${customers}
      where ${customers.searchText} like ${pattern}))
    or ${customerMessages.orderId} = any(array(
      select ${orders.id} from ${orders}
      where fig_normalize(${orders.reference}) like ${pattern})))`;
}

/**
 * Jour de réception en UTC, exactement la découpe de receivedDay() côté règle
 * pure (`receivedAt.slice(0, 10)` sur une chaîne ISO en Z).
 */
const receivedDay = sql`(${customerMessages.receivedAt} at time zone 'UTC')::date`;

function whereFor(filters: MessageFilters): SQL | undefined {
  const clauses = [
    filters.status ? eq(customerMessages.status, filters.status) : undefined,
    filters.subject ? eq(customerMessages.subject, filters.subject) : undefined,
    filters.from ? sql`${receivedDay} >= ${filters.from}::date` : undefined,
    filters.to ? sql`${receivedDay} <= ${filters.to}::date` : undefined,
    filters.important ? eq(customerMessages.important, true) : undefined,
    filters.customerId
      ? eq(customerMessages.customerId, filters.customerId)
      : undefined,
    queryClause(filters.query),
  ].filter((clause): clause is SQL => clause !== undefined);
  return clauses.length === 0 ? undefined : and(...clauses);
}

/** Le message relu après une écriture réussie, avec ses jointures. */
async function reload(db: DbExecutor, id: string): Promise<Message | null> {
  const [message] = await loadMessages(db, eq(customerMessages.id, id));
  return message ?? null;
}

export const messagesDb: MessagesSource = {
  getMessagesPage: async (
    filters: MessageFilters,
    page: number,
    size = MESSAGES_PAGE_SIZE,
  ) => {
    const db = getDb();
    const where = whereFor(filters);
    // La page demandée et le total en parallèle ; un numéro au-delà de la
    // dernière page (URL modifiée à la main) coûte une relecture, ramenée dans
    // les bornes par pageWindow.
    const asked = pageWindow(Number.MAX_SAFE_INTEGER, page, size);
    const read = (offset: number) =>
      loadMessages(db, where, { limit: size, offset });
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

  countMessages: (filters: MessageFilters) =>
    countWhere(getDb(), whereFor(filters)),

  getMessage: (id: string) => reload(getDb(), id),

  // Export RGPD : tout, dans l'ordre où la personne a écrit. Le tri de la
  // boîte de réception (épinglés d'abord) n'aurait aucun sens dans un export.
  getCustomerMessages: async (customerId: string) => {
    const messages = await loadMessages(
      getDb(),
      eq(customerMessages.customerId, customerId),
    );
    return messages.toSorted((a, b) =>
      a.receivedAt.localeCompare(b.receivedAt),
    );
  },

  setMessageStatus: async (id: string, change: MessageStatusChange) => {
    const db = getDb();
    const updated = await db
      .update(customerMessages)
      .set({
        status: change.to,
        // Qui et quand, relus de la session et de l'horloge du serveur ; la
        // contrainte customer_messages_handled_consistent exige les deux.
        handledAt: new Date(change.at),
        handledByName: change.actor.name,
      })
      .where(
        and(
          eq(customerMessages.id, id),
          eq(customerMessages.status, change.from),
        ),
      )
      .returning({ id: customerMessages.id });
    return updated.length === 0 ? null : reload(db, id);
  },

  setMessagePinned: async (id: string, change: MessagePinChange) => {
    const db = getDb();
    const updated = await db
      .update(customerMessages)
      .set({ pinnedAt: change.to ? new Date(change.at) : null })
      .where(
        and(
          eq(customerMessages.id, id),
          // L'épingle est-elle encore dans l'état que l'écran montrait ?
          change.from
            ? isNotNull(customerMessages.pinnedAt)
            : isNull(customerMessages.pinnedAt),
        ),
      )
      .returning({ id: customerMessages.id });
    return updated.length === 0 ? null : reload(db, id);
  },

  setMessageImportant: async (id: string, change: MessageImportantChange) => {
    const db = getDb();
    const updated = await db
      .update(customerMessages)
      .set({ important: change.to })
      .where(
        and(
          eq(customerMessages.id, id),
          eq(customerMessages.important, change.from),
        ),
      )
      .returning({ id: customerMessages.id });
    return updated.length === 0 ? null : reload(db, id);
  },
};
