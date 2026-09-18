import { z } from "zod";
import { SECURITY_FAMILIES } from "@/domain/security/events";
import {
  SECURITY_SEARCH_MAX_LENGTH,
  type SecurityFilters,
} from "@/domain/security/types";
import { parsePeriodInput } from "@/domain/orders/schemas";

/*
 * Entrées de l'écran Journal, en LECTURE TOLÉRANTE comme les autres listes :
 * une valeur d'URL invalide est ignorée et le journal s'affiche, plutôt qu'une
 * page d'erreur devant quelqu'un qui enquête.
 *
 * Aucun schéma d'écriture ici, et il ne doit jamais y en avoir : le journal
 * n'est écrit que par `logSecurity`, jamais par un écran.
 */
const familiesSchema = z
  .union([z.enum(SECURITY_FAMILIES), z.array(z.enum(SECURITY_FAMILIES))])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional()
  .catch(undefined);

const securityFiltersSchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(SECURITY_SEARCH_MAX_LENGTH)
      .transform((v) => (v === "" ? undefined : v))
      .optional()
      .catch(undefined),
    // Cases à cocher : le paramètre est répété, donc lu en tableau.
    famille: familiesSchema,
    du: z.iso.date().optional().catch(undefined),
    au: z.iso.date().optional().catch(undefined),
  })
  .transform(({ q, famille, du, au }): SecurityFilters => {
    const period = parsePeriodInput({ du, au });
    // Toutes les familles cochées revient à n'en cocher aucune.
    const families =
      famille === undefined || famille.length === SECURITY_FAMILIES.length
        ? undefined
        : [...new Set(famille)];
    return {
      query: q,
      families,
      from: period.range?.from,
      to: period.range?.to,
    };
  });

/** Seule porte d'entrée de la page : searchParams déjà await → SecurityFilters. */
export function parseSecurityFilters(
  raw: Record<string, string | string[] | undefined>,
): SecurityFilters {
  return securityFiltersSchema.parse(raw);
}
