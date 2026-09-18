import { requireService } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { markNotificationSent } from "@/data/notifications";
import { logSecurity } from "@/data/security-log";
import { apiIdSchema } from "@/domain/api/schemas";
import { ApiError, notFound } from "@/lib/api/errors";

/*
 * POST /api/v1/service/notifications/{id}/envoi (clé de service) : accusé
 * d'envoi d'une notification, qui pose `sent_at` UNE fois (écriture
 * conditionnelle) ; 409 si elle était déjà marquée envoyée, 404 si inconnue.
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

export const POST = apiRoute<{ id: string }>(METHODS, async (call) => {
  requireService(call);
  const id = apiIdSchema.safeParse(call.params.id);
  const outcome = id.success
    ? await markNotificationSent(id.data, call.now)
    : "not_found";
  if (outcome === "not_found") throw notFound("Notification introuvable.");
  if (outcome === "already_sent") {
    throw new ApiError(
      409,
      "already_sent",
      "Cette notification est déjà marquée comme envoyée.",
    );
  }
  logSecurity({ type: "api_notification_sent", notificationId: id.data! });
  return json(call, { ok: true });
});
