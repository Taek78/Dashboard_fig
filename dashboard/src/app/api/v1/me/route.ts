import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { accountClosed, loadMe, viewOf } from "@/app/api/v1/_lib/customers";
import { updateCustomerProfile } from "@/data/customers";
import { logSecurity } from "@/data/security-log";
import { updateProfileSchema } from "@/domain/api/schemas";
import { readJsonBody } from "@/lib/api/request";

/*
 * GET /api/v1/me : la fiche de la personne connectée, avec sa fidélité, sa
 * catégorie, sa communauté et sa prochaine remise.
 * PATCH /api/v1/me : modification partielle du profil ; les trois
 * autorisations changent ensemble et sont datées par le serveur (preuve du
 * consentement). L'e-mail ne se modifie pas.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET", "PATCH"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  return json(call, await loadMe(customer.id, call.now));
});

export const PATCH = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const patch = await readJsonBody(call.request, updateProfileSchema);
  const updated = await updateCustomerProfile(customer.id, patch, call.now);
  if (!updated) throw accountClosed();
  logSecurity({
    type: "api_profile_updated",
    customerId: customer.id,
    consents: patch.consents !== undefined,
  });
  return json(call, await viewOf(updated, call.now));
});
