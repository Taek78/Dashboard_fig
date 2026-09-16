import { z } from "zod";
import {
  DEFAULT_DIRECTORY_ORDER,
  DIRECTORY_TYPES,
  isSortAvailable,
  parseSortParam,
  type DirectorySearch,
} from "@/domain/customers/directory";
import { NOTE_MAX_LENGTH } from "@/domain/customers/types";
import { parseOrderFilters } from "@/domain/orders/schemas";
import type { OrderFilters } from "@/domain/orders/types";

/* Schémas zod des ENTRÉES des clients : recherche tolérante, note stricte. */
export const customerIdSchema = z.string().trim().min(1).max(64);

/**
 * Recherche de la section Clients (lecture tolérante) : ?q= (partie du nom, de
 * l'e-mail, du téléphone, de la ville, d'une communauté ou d'un code de
 * parrainage), ?type=tous|particuliers|communautes, ?tri=<tri> ou
 * <tri>-<sens> (nom, commandes, montant, recent, membres ; croissant ou
 * decroissant, sinon le sens naturel du tri ; membres : communautés seulement,
 * sinon retour au nom), ?page=n. Une valeur invalide est ignorée : la liste
 * complète s'affiche.
 */
export type ClientsSearch = DirectorySearch & { page: number };

const clientsSearchSchema = z
  .object({
    q: z.string().trim().min(1).max(64).optional().catch(undefined),
    type: z.enum(DIRECTORY_TYPES).optional().catch(undefined),
    tri: z.string().trim().max(32).optional().catch(undefined),
    page: z
      .string()
      .regex(/^\d{1,6}$/)
      .optional()
      .catch(undefined),
  })
  .transform(({ q, type, tri, page }): ClientsSearch => {
    const shown = type ?? "tous";
    const parsed = parseSortParam(tri);
    const sorting =
      parsed !== undefined && isSortAvailable(parsed.sort, shown)
        ? parsed
        : { sort: "nom" as const, order: DEFAULT_DIRECTORY_ORDER.nom };
    return {
      query: q,
      type: shown,
      sort: sorting.sort,
      order: sorting.order,
      page: Math.max(1, Number(page ?? "1")),
    };
  });

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
