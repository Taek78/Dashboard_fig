import { z } from "zod";
import { MESSAGE_STATUSES } from "@/domain/messages/status";
import { MESSAGE_SUBJECTS } from "@/domain/messages/subject";
import {
  IMPORTANT_FILTER,
  MESSAGE_SEARCH_MAX_LENGTH,
  type MessageFilters,
} from "@/domain/messages/types";
import { parsePeriodInput } from "@/domain/orders/schemas";

/*
 * Schémas zod des ENTRÉES de la boîte de réception. Deux régimes, comme
 * partout : TOLÉRANT en lecture (une valeur d'URL invalide est ignorée, la
 * liste s'affiche) et STRICT en écriture (une valeur invalide fait échouer
 * l'action).
 *
 * Rien ici ne valide le CONTENU d'un message : le dashboard ne l'écrit jamais,
 * c'est l'application FIG qui l'insère. La base garde cette frontière-là
 * (enums, contraintes, dix pièces jointes au plus).
 */
export const messageIdSchema = z.string().trim().min(1).max(64);

/*
 * Recherche et filtres de la liste. Clés d'URL en français
 * (?q=…&statut=…&objet=…&du=…&au=…&important=oui), clés de code en anglais :
 * transform. z.object ignore les clés inconnues (page…) ; un paramètre répété
 * arrive en tableau, échoue et tombe dans catch.
 * - q : trimée ; vide = pas de recherche, trop longue = ignorée ;
 * - du / au : jours de RÉCEPTION, lus par la règle commune des périodes
 *   (parsePeriodInput : une seule date = ce jour-là, inversées = aucune) ;
 * - important : seule la valeur « oui » filtre ; tout le reste est ignoré.
 */
const messageFiltersSchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(MESSAGE_SEARCH_MAX_LENGTH)
      .transform((v) => (v === "" ? undefined : v))
      .optional()
      .catch(undefined),
    statut: z.enum(MESSAGE_STATUSES).optional().catch(undefined),
    objet: z.enum(MESSAGE_SUBJECTS).optional().catch(undefined),
    du: z.iso.date().optional().catch(undefined),
    au: z.iso.date().optional().catch(undefined),
    important: z.literal(IMPORTANT_FILTER).optional().catch(undefined),
  })
  .transform(({ q, statut, objet, du, au, important }): MessageFilters => {
    const period = parsePeriodInput({ du, au });
    return {
      query: q,
      status: statut,
      subject: objet,
      from: period.range?.from,
      to: period.range?.to,
      important: important === undefined ? undefined : true,
    };
  });

/** Seule porte d'entrée de la page Messages : searchParams déjà await → MessageFilters.
 *  parse et non safeParse : avec un catch sur chaque champ, ce schéma ne peut
 *  pas échouer sur un objet, il n'y a aucun cas d'erreur à traiter. */
export function parseMessageFilters(
  raw: Record<string, string | string[] | undefined>,
): MessageFilters {
  return messageFiltersSchema.parse(raw);
}

/*
 * Écritures. Le statut visé est validé, mais l'action relit de toute façon le
 * message en base : `nextStatus` ne sert qu'à dire ce que l'écran demandait.
 */
export const setMessageStatusSchema = z.object({
  messageId: messageIdSchema,
  nextStatus: z.enum(MESSAGE_STATUSES),
});

/*
 * Épingle et signalement « important » : deux bascules. La valeur visée arrive
 * en « oui » / « non » (ce que le bouton envoie), convertie en booléen ici pour
 * que l'action ne manipule jamais de chaîne. Une valeur absente ou autre fait
 * échouer l'action : sur une bascule, deviner est pire que refuser.
 */
const flagValueSchema = z
  .enum(["oui", "non"])
  .transform((value) => value === "oui");

export const setMessagePinnedSchema = z.object({
  messageId: messageIdSchema,
  pinned: flagValueSchema,
});

export const setMessageImportantSchema = z.object({
  messageId: messageIdSchema,
  important: flagValueSchema,
});
