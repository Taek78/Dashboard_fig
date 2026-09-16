import { isClaimSubject } from "@/domain/messages/subject";
import {
  IMPORTANT_FILTER,
  MESSAGE_PREVIEW_LINES,
  type Message,
  type MessageFilters,
} from "@/domain/messages/types";
import type { DateRange } from "@/lib/days";
import { normalize } from "@/lib/text";

/*
 * Logique pure de la boîte de réception : aucune dépendance à Next, à la base
 * ni au navigateur. Ces fonctions servent deux fois — aux écrans, et de
 * RÉFÉRENCE aux requêtes SQL de src/data/messages.db.ts, que
 * test/data/messages.db.test.ts compare à elles sur les données seedées.
 */

/**
 * Les deux premières lignes du message, pour la carte de la liste. Les lignes
 * vides sont sautées (un client qui saute une ligne après « Bonjour » ne doit
 * pas gaspiller son aperçu), les espaces multiples sont réduits. Le CSS
 * tronque ensuite ce qui dépasse ; la règle, elle, reste testable.
 */
export function messagePreview(
  body: string,
  lines = MESSAGE_PREVIEW_LINES,
): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, lines)
    .join(" ")
    .replace(/\s+/g, " ");
}

/**
 * Vrai si le message correspond à la recherche libre : nom du client, e-mail,
 * corps du message, ou référence de la commande associée ; sans accents ni
 * majuscules. Recherche vide ou absente : tout correspond.
 *
 * Volontairement PAS l'objet de la demande : il a son propre filtre, et une
 * recherche « livraison » doit trouver les messages qui PARLENT de livraison,
 * pas les six cents classés « Problème de livraison ».
 */
export function matchesMessageQuery(
  message: Message,
  query: string | undefined,
): boolean {
  const q = normalize(query ?? "");
  if (q === "") return true;
  const fields = [
    message.customer.fullName,
    message.customer.email,
    message.body,
    message.order?.reference ?? "",
  ];
  return fields.some((field) => normalize(field).includes(q));
}

/** Jour de réception "AAAA-MM-JJ" (UTC), même découpe que `(received_at at time zone 'UTC')::date` en SQL. */
export function receivedDay(message: Message): string {
  return message.receivedAt.slice(0, 10);
}

/**
 * Garde les messages qui passent TOUS les filtres présents. Un critère absent
 * (undefined) laisse tout passer. Ne trie pas : c'est le rôle de sortMessages.
 */
export function filterMessages(
  messages: readonly Message[],
  filters: MessageFilters,
): Message[] {
  return messages.filter((message) => {
    const day = receivedDay(message);
    return (
      (filters.status === undefined || message.status === filters.status) &&
      (filters.subject === undefined || message.subject === filters.subject) &&
      (filters.from === undefined || day >= filters.from) &&
      (filters.to === undefined || day <= filters.to) &&
      (filters.important === undefined || message.important) &&
      (filters.customerId === undefined ||
        message.customer.id === filters.customerId) &&
      matchesMessageQuery(message, filters.query)
    );
  });
}

/**
 * Nombre de RÉCLAMATIONS reçues sur une période (jour de réception, bornes
 * incluses) : les messages dont l'objet est une réclamation (CLAIM_SUBJECTS),
 * quel que soit leur statut de traitement. Référence de la requête agrégée
 * countComplaints (messages.db.ts), affichée par les métriques.
 */
export function countComplaints(
  messages: readonly Message[],
  range: DateRange,
): number {
  return messages.filter((message) => {
    const day = receivedDay(message);
    return (
      isClaimSubject(message.subject) && day >= range.from && day <= range.to
    );
  }).length;
}

/** Vrai si un filtre de la barre (recherche, statut, objet, période, importants) est actif. */
export function hasMessageFilters(filters: MessageFilters): boolean {
  return (
    filters.query !== undefined ||
    filters.status !== undefined ||
    filters.subject !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.important !== undefined
  );
}

/**
 * Filtres → paramètres d'URL, avec les clés françaises que parseMessageFilters
 * relit : la pagination garde la recherche en cours. customerId ne passe
 * jamais par l'URL.
 */
export function messageFiltersQuery(filters: MessageFilters): string {
  const entries: [string, string | undefined][] = [
    ["q", filters.query],
    ["statut", filters.status],
    ["objet", filters.subject],
    ["du", filters.from],
    ["au", filters.to],
    ["important", filters.important ? IMPORTANT_FILTER : undefined],
  ];
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}

/**
 * Copie triée telle que la boîte de réception s'affiche : les messages
 * ÉPINGLÉS d'abord (le plus récemment épinglé en tête), puis les autres du
 * plus récent au plus ancien. L'identifiant départage pour un ordre identique à
 * chaque appel quand deux messages partagent le même instant.
 *
 * L'épingle passe avant tout le reste, y compris avant « important » : c'est le
 * geste explicite de l'équipe (« celui-là, je le garde sous les yeux »), alors
 * qu'« important » est une étiquette qui, elle, se filtre.
 */
export function sortMessages(messages: readonly Message[]): Message[] {
  return messages.toSorted((a, b) => {
    if ((a.pinnedAt === null) !== (b.pinnedAt === null)) {
      return a.pinnedAt === null ? 1 : -1;
    }
    if (
      a.pinnedAt !== null &&
      b.pinnedAt !== null &&
      a.pinnedAt !== b.pinnedAt
    ) {
      return b.pinnedAt.localeCompare(a.pinnedAt);
    }
    return b.receivedAt.localeCompare(a.receivedAt) || a.id.localeCompare(b.id);
  });
}

/** Taille d'une page de la boîte de réception : un message prend plus de place qu'une commande. */
export const MESSAGES_PAGE_SIZE = 20;
