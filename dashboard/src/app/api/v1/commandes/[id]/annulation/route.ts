import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { getOrder, updateOrderStatus } from "@/data/orders";
import { logSecurity } from "@/data/security-log";
import { apiIdSchema, cancelOrderSchema } from "@/domain/api/schemas";
import { orderView } from "@/domain/api/views";
import { ApiError, notFound } from "@/lib/api/errors";
import { readJsonBodyOrEmpty } from "@/lib/api/request";

/*
 * POST /api/v1/commandes/{id}/annulation { detail? } : la personne annule sa
 * commande tant qu'elle est EN PRÉPARATION (motif « Annulée par le client »,
 * précision facultative). Écriture conditionnelle sur le statut relu : une
 * commande passée en tournée entre-temps n'est plus annulable (409). Rejouer
 * l'annulation d'une commande déjà annulée par la personne renvoie 200
 * (idempotent). Aucune notification déposée : c'est elle qui agit.
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

const CUSTOMER_ACTOR_NAME = "Le client, depuis l'application";

export const POST = apiRoute<{ id: string }>(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { detail } = await readJsonBodyOrEmpty(call.request, cancelOrderSchema);
  const id = apiIdSchema.safeParse(call.params.id);
  const order = id.success ? await getOrder(id.data) : null;
  if (!order || order.customer.id !== customer.id) {
    throw notFound("Commande introuvable.");
  }
  if (
    order.status === "cancelled" &&
    order.cancellation?.reason === "customer"
  ) {
    return json(call, orderView(order));
  }
  if (order.status !== "preparing") {
    throw new ApiError(
      409,
      "not_cancellable",
      "Cette commande n'est plus en préparation : contactez l'équipe FIG pour l'annuler.",
    );
  }
  const updated = await updateOrderStatus(order.id, {
    from: "preparing",
    to: "cancelled",
    actor: { id: customer.id, name: CUSTOMER_ACTOR_NAME },
    cancellation: { reason: "customer", detail: detail ? detail : null },
    notification: null,
  });
  if (!updated) {
    throw new ApiError(
      409,
      "conflict",
      "La commande a changé entre-temps : relisez-la avant de réessayer.",
    );
  }
  logSecurity({
    type: "api_order_cancelled",
    customerId: customer.id,
    orderId: order.id,
  });
  return json(call, orderView(updated));
});
