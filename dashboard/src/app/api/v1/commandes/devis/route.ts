import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { orderContextFor } from "@/app/api/v1/_lib/customers";
import { quoteSchema } from "@/domain/api/schemas";
import { quoteView } from "@/domain/api/views";
import { buildQuote } from "@/domain/orders/quote";
import { ApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";

/*
 * POST /api/v1/commandes/devis { lines } : le prix d'un panier tel que le
 * dashboard le calcule (lignes instantanées, meilleure remise, frais, total),
 * à afficher avant le paiement. Un panier invalide (produit inconnu ou plus
 * en vente, stock insuffisant, quantité hors bornes, doublon) est refusé avec
 * TOUS ses problèmes (422 quote_invalid).
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

export const POST = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { lines } = await readJsonBody(call.request, quoteSchema);
  const result = buildQuote(lines, await orderContextFor(customer));
  if (!result.ok) {
    throw new ApiError(
      422,
      "quote_invalid",
      "Le panier contient des lignes invalides.",
      { details: { problems: result.problems } },
    );
  }
  return json(call, quoteView(result.quote));
});
