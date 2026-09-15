import { z } from "zod";
import {
  DIRECTORY_SORTS,
  DIRECTORY_TYPES,
  type DirectorySearch,
} from "@/domain/customers/directory";
import { NOTE_MAX_LENGTH } from "@/domain/customers/types";
import { parseOrderFilters } from "@/domain/orders/schemas";
import type { OrderFilters } from "@/domain/orders/types";

/* Schémas zod des ENTRÉES des clients : recherche tolérante, note stricte. */
export const customerIdSchema = z.string().trim().min(1).max(64);

/**
 * Recherche de la section Clients (lecture tolérante) : ?q= (partie du nom, de
 * l'e-mail, du téléphone, de la ville ou d'une communauté),
 * ?type=tous|particuliers|communautes, ?tri=nom|commandes|montant|recent,
 * ?page=n. Une valeur invalide est ignorée : la liste complète s'affiche.
 */
export type ClientsSearch = DirectorySearch & { page: number };

const clientsSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(64).optional().catch(undefined),
    type: z.enum(DIRECTORY_TYPES).optional().catch(undefined),
    tri: z.enum(DIRECTORY_SORTS).optional().catch(undefined),
    page: z
      .string()
      .regex(/^\d{1,6}$/)
      .optional()
      .catch(undefined),
  })
  .transform(({ q, type, tri, page }): ClientsSearch => ({
    query: q,
    type: type ?? "tous",
    sort: tri ?? "nom",
    page: Math.max(1, Number(page ?? "1")),
  }));

export function parseClientsSearch(
  raw: Record<string, string | string[] | undefined>,
): ClientsSearch {
  return clientsSearchSchema.parse(raw);
}

/**
 * Période de l'historique d'une fiche client (lecture tolérante) : ?du= et ?au=,
 * jours de livraison, lus par la même règle que la liste des commandes (date
 * invalide ignorée, bornes inversées remises dans l'ordre). Les autres clés
 * (q, statut…) ne s'appliquent pas à la fiche.
 */
export type CustomerHistoryPeriod = Pick<OrderFilters, "from" | "to">;

export function parseCustomerHistoryPeriod(
  raw: Record<string, string | string[] | undefined>,
): CustomerHistoryPeriod {
  const { from, to } = parseOrderFilters(raw);
  return { from, to };
}

export { NOTE_MAX_LENGTH };

export const addNoteSchema = z.object({
  customerId: customerIdSchema,
  text: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
});
