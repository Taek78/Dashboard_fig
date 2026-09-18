import { requireCustomer } from "@/app/api/v1/_lib/auth";
import {
  apiRoute,
  json,
  preflight,
  type RouteCall,
} from "@/app/api/v1/_lib/context";
import { accountClosed, loadMe } from "@/app/api/v1/_lib/customers";
import { setCustomerCommunity } from "@/data/customers";
import { logSecurity } from "@/data/security-log";
import { joinCommunitySchema } from "@/domain/api/schemas";
import { ApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";

/*
 * PUT /api/v1/me/communaute { communityId } : rejoindre une communauté
 * PUBLIQUE et active (la base le vérifie dans la même instruction) ;
 * DELETE : la quitter. Une communauté privée s'intègre sur invitation, hors
 * de l'API pour l'instant. Réponse : la fiche à jour.
 */
export const dynamic = "force-dynamic";
const METHODS = ["PUT", "DELETE"] as const;
export const OPTIONS = preflight(METHODS);

async function apply(
  call: RouteCall<Record<string, never>>,
  customerId: string,
  communityId: string | null,
): Promise<Response> {
  const outcome = await setCustomerCommunity(customerId, communityId);
  if (outcome === "not_found") throw accountClosed();
  if (outcome === "not_joinable") {
    throw new ApiError(
      422,
      "community_not_joinable",
      "Cette communauté n'est pas ouverte à l'adhésion directe.",
    );
  }
  logSecurity({ type: "api_community_changed", customerId, communityId });
  return json(call, await loadMe(customerId, call.now));
}

export const PUT = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { communityId } = await readJsonBody(call.request, joinCommunitySchema);
  return apply(call, customer.id, communityId);
});

export const DELETE = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  return apply(call, customer.id, null);
});
