import { requireService } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { listPendingNotifications } from "@/data/notifications";
import { pendingNotificationsQuerySchema } from "@/domain/api/schemas";
import { pendingNotificationView } from "@/domain/api/views";
import { readQuery } from "@/lib/api/request";

/*
 * GET /api/v1/service/notifications?limit= (clé de service) : la file des
 * notifications d'état à envoyer, dans l'ordre de dépôt. Le serveur de
 * l'application les envoie par son canal puis appelle
 * POST /service/notifications/{id}/envoi (question 23).
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  requireService(call);
  const { limit } = readQuery(
    call.request.url,
    pendingNotificationsQuerySchema,
  );
  const pending = await listPendingNotifications(limit);
  return json(call, {
    items: pending.map(pendingNotificationView),
    nextCursor: null,
  });
});
