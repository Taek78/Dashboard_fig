import { requireCustomer } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { listCustomerNotificationsPage } from "@/data/notifications";
import { listQuerySchema } from "@/domain/api/schemas";
import { notificationView, pageView } from "@/domain/api/views";
import { decodeCursor } from "@/lib/api/cursor";
import { readQuery } from "@/lib/api/request";

/*
 * GET /api/v1/me/notifications?limit=&cursor= : les notifications d'état
 * déposées pour la personne, les plus récentes d'abord (historique de
 * l'application). L'envoi lui-même passe par la file de service.
 */
export const dynamic = "force-dynamic";
const METHODS = ["GET"] as const;
export const OPTIONS = preflight(METHODS);

export const GET = apiRoute(METHODS, async (call) => {
  const { customer } = await requireCustomer(call);
  const { limit, cursor } = readQuery(call.request.url, listQuerySchema);
  const page = await listCustomerNotificationsPage(customer.id, {
    limit,
    after: decodeCursor(cursor),
  });
  return json(call, pageView(page, notificationView));
});
