import { z } from "zod";
import { NOTE_MAX_LENGTH } from "@/domain/customers/types";

/* Schémas zod des ENTRÉES des clients : recherche tolérante, note stricte. */
export const customerIdSchema = z.string().trim().min(1).max(64);

/**
 * ?type=particuliers|communautes : l'onglet (particuliers par défaut) ;
 * ?q=texte : recherche ; ?tous=1 : tout afficher. Ni q ni tous : la page reste
 * sur le moteur de recherche sans charger de liste.
 */
export const CUSTOMER_TABS = ["particuliers", "communautes"] as const;
export type CustomerTab = (typeof CUSTOMER_TABS)[number];

const customerSearchSchema = z
  .object({
    type: z.enum(CUSTOMER_TABS).optional().catch(undefined),
    q: z.string().trim().min(1).max(64).optional().catch(undefined),
    tous: z.literal("1").optional().catch(undefined),
  })
  .transform(({ type, q, tous }) => ({
    tab: type ?? ("particuliers" as CustomerTab),
    query: q,
    all: tous === "1",
  }));

export type CustomerSearch = z.output<typeof customerSearchSchema>;

export function parseCustomerSearch(
  raw: Record<string, string | string[] | undefined>,
): CustomerSearch {
  return customerSearchSchema.parse(raw);
}

export { NOTE_MAX_LENGTH };

export const addNoteSchema = z.object({
  customerId: customerIdSchema,
  text: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
});
