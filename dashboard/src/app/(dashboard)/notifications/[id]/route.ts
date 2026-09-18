import { getNotificationDelivery } from "@/data/notifications";
import { getCurrentUser } from "@/data/session";
import { canChangeOrderStatus } from "@/domain/auth/roles";
import { notificationIdSchema } from "@/domain/notifications/schemas";
import { isCrossSiteRequest } from "@/lib/fetch-site";

/*
 * GET /notifications/[id] : où en est l'envoi d'une notification déposée pour
 * un client (en attente, envoyée, en échec), relu toutes les 3 s par le badge
 * « Client notifié » de la liste du statut (NotificationDeliveryBadge) tant
 * qu'il attend l'accusé de l'application. Réservé à qui change un statut
 * (canChangeOrderStatus, c'est lui qui a déposé la notification) ; autre
 * site refusé ; jamais en cache ; ne renouvelle pas la session
 * (isBackgroundPoll).
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(
  request: Request,
  ctx: RouteContext<"/notifications/[id]">,
) {
  const user = await getCurrentUser();
  if (!canChangeOrderStatus(user.role) || isCrossSiteRequest(request.headers)) {
    return new Response("Accès refusé.", { status: 403, headers: NO_STORE });
  }
  const parsed = notificationIdSchema.safeParse((await ctx.params).id);
  const delivery = parsed.success
    ? await getNotificationDelivery(parsed.data)
    : null;
  if (!delivery) {
    return new Response("Notification introuvable.", {
      status: 404,
      headers: NO_STORE,
    });
  }
  return Response.json(
    { state: delivery.state, failureReason: delivery.failureReason },
    { headers: NO_STORE },
  );
}
