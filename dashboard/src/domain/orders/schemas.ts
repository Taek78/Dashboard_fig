import { z } from "zod";
import { ASSIGNMENT_ROLES } from "@/domain/orders/assignment";
import {
  CANCELLATION_DETAIL_MAX_LENGTH,
  CANCELLATION_REASONS,
} from "@/domain/orders/cancellation";
import { ORDER_STATUSES } from "@/domain/orders/status";
import {
  ORDER_SEARCH_MAX_LENGTH,
  UNASSIGNED_FILTER,
  type OrderFilters,
} from "@/domain/orders/types";

/*
 * Schémas zod des ENTRÉES des commandes : ce qui arrive du navigateur (FormData,
 * searchParams, params) est hostile tant qu'il n'est pas passé ici. Les types
 * métier (Order…) restent en TypeScript simple : zod ne valide que la frontière.
 *
 * Deux régimes :
 *   - écriture (changeStatusSchema) : STRICT, une valeur invalide fait échouer
 *     l'action, qui renvoie une erreur ;
 *   - lecture (orderFiltersSchema) : TOLÉRANT, une valeur invalide est ignorée
 *     (.catch(undefined) = « pas de filtre »), la liste complète s'affiche.
 *
 * Pas de regex sur l'id : c'est un texte libre de 64 caractères au plus.
 */
export const orderIdSchema = z.string().trim().min(1).max(64);

/*
 * Changement de statut. Annuler exige un motif (reason) ; « autre » exige une
 * précision (detail, 100 caractères au plus). Pour tout autre statut, motif et
 * précision sont ignorés. Sortie : { orderId, nextStatus, cancellation | null }.
 */
export const changeStatusSchema = z
  .object({
    orderId: orderIdSchema,
    nextStatus: z.enum(ORDER_STATUSES),
    reason: z.enum(CANCELLATION_REASONS).optional(),
    detail: z.string().trim().max(CANCELLATION_DETAIL_MAX_LENGTH).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.nextStatus !== "cancelled") return;
    if (!v.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Motif d'annulation requis",
      });
    } else if (v.reason === "other" && !v.detail) {
      ctx.addIssue({
        code: "custom",
        path: ["detail"],
        message: "Précisez le motif",
      });
    }
  })
  .transform(({ orderId, nextStatus, reason, detail }) => ({
    orderId,
    nextStatus,
    cancellation:
      nextStatus === "cancelled" && reason
        ? { reason, detail: reason === "other" ? (detail ?? null) : null }
        : null,
  }));

/*
 * Recherche et filtres des listes de commandes et de livraisons. Clés d'URL en
 * français (?q=…&statut=…&du=…&au=…&preparateur=…&livreur=…), clés de code en
 * anglais : transform. z.object ignore les clés inconnues (simuler, page…) ; un
 * paramètre répété arrive en tableau, échoue et tombe dans catch.
 * - q : trimée ; vide = pas de recherche, trop longue = ignorée ;
 * - du / au : jours de livraison, remis dans l'ordre s'ils sont inversés ;
 * - date : ancienne clé d'un seul jour, encore lue pour les liens existants ;
 * - preparateur / livreur : l'id d'une personne, ou « aucun »
 *   (UNASSIGNED_FILTER) pour les commandes sans personne affectée.
 */
const staffFilterSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((v) => (v === UNASSIGNED_FILTER ? null : v))
  .optional()
  .catch(undefined);

export const orderFiltersSchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(ORDER_SEARCH_MAX_LENGTH)
      .transform((v) => (v === "" ? undefined : v))
      .optional()
      .catch(undefined),
    statut: z.enum(ORDER_STATUSES).optional().catch(undefined),
    du: z.iso.date().optional().catch(undefined),
    au: z.iso.date().optional().catch(undefined),
    date: z.iso.date().optional().catch(undefined),
    preparateur: staffFilterSchema,
    livreur: staffFilterSchema,
  })
  .transform(
    ({ q, statut, du, au, date, preparateur, livreur }): OrderFilters => {
      const from = du ?? (au === undefined ? date : undefined);
      const to = au ?? (du === undefined ? date : undefined);
      const inverted = from !== undefined && to !== undefined && from > to;
      return {
        query: q,
        status: statut,
        from: inverted ? to : from,
        to: inverted ? from : to,
        preparerId: preparateur,
        driverId: livreur,
      };
    },
  );

/** Seule porte d'entrée des pages Commandes et Livraisons : searchParams déjà await → OrderFilters.
 *  parse et non safeParse : avec un catch sur chaque champ, ce schéma ne peut
 *  pas échouer sur un objet, il n'y a aucun cas d'erreur à traiter. */
export function parseOrderFilters(
  raw: Record<string, string | string[] | undefined>,
): OrderFilters {
  return orderFiltersSchema.parse(raw);
}

/*
 * Affectation d'une personne (préparateur ou livreur) : l'id de la personne,
 * ou une chaîne vide pour retirer l'affectation. L'action relit la personne
 * et vérifie son métier ; ici on ne valide que la forme.
 */
export const assignStaffSchema = z.object({
  orderId: orderIdSchema,
  role: z.enum(ASSIGNMENT_ROLES),
  staffId: z
    .string()
    .trim()
    .max(64)
    .transform((v) => (v === "" ? null : v)),
});

/** ?page=n de la liste (lecture tolérante) : entier ≥ 1, sinon 1. */
export function parsePage(
  raw: Record<string, string | string[] | undefined>,
): number {
  const value = raw.page;
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}
