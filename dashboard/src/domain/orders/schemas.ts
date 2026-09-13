import { z } from "zod";
import {
  CANCELLATION_DETAIL_MAX_LENGTH,
  CANCELLATION_REASONS,
} from "@/domain/orders/cancellation";
import { ORDER_STATUSES } from "@/domain/orders/status";
import type { OrderFilters } from "@/domain/orders/types";

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
 * Pas de regex sur l'id : son format appartient à la base du client (piste B2).
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

// Clés d'URL en français (?statut=…&date=…), clés de code en anglais : transform.
// z.object ignore les clés inconnues (simuler…) ; un paramètre répété arrive en
// tableau, échoue sur l'enum et tombe lui aussi dans catch.
export const orderFiltersSchema = z
  .object({
    statut: z.enum(ORDER_STATUSES).optional().catch(undefined),
    date: z.iso.date().optional().catch(undefined),
  })
  .transform(({ statut, date }) => ({ status: statut, date }));

/** Seule porte d'entrée de la page liste : searchParams déjà await → OrderFilters.
 *  parse et non safeParse : avec un catch sur chaque champ, ce schéma ne peut
 *  pas échouer sur un objet, il n'y a aucun cas d'erreur à traiter. */
export function parseOrderFilters(
  raw: Record<string, string | string[] | undefined>,
): OrderFilters {
  return orderFiltersSchema.parse(raw);
}
