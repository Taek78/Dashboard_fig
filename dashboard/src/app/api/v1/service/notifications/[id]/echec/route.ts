import { requireService } from "@/app/api/v1/_lib/auth";
import { apiRoute, json, preflight } from "@/app/api/v1/_lib/context";
import { markNotificationFailed } from "@/data/notifications";
import { logSecurity } from "@/data/security-log";
import { apiIdSchema, notificationFailureSchema } from "@/domain/api/schemas";
import { ApiError, notFound } from "@/lib/api/errors";
import { readJsonBodyOrEmpty } from "@/lib/api/request";

/*
 * POST /api/v1/service/notifications/{id}/echec (clé de service) : le serveur
 * de l'application déclare que l'envoi a échoué, avec une cause courte
 * facultative ({ "raison": "…" }). La notification sort de la file ; le
 * back-office l'affiche en échec et propose « Réessayer ». Une seule fois
 * (écriture conditionnelle) : 409 si elle est déjà envoyée ou déjà en échec,
 * 404 si inconnue.
 */
export const dynamic = "force-dynamic";
const METHODS = ["POST"] as const;
export const OPTIONS = preflight(METHODS);

export const POST = apiRoute<{ id: string }>(METHODS, async (call) => {
  requireService(call);
  const { raison } = await readJsonBodyOrEmpty(
    call.request,
    notificationFailureSchema,
  );
  const id = apiIdSchema.safeParse(call.params.id);
  const outcome = id.success
    ? await markNotificationFailed(id.data, call.now, raison ?? null)
    : "not_found";
  if (outcome === "not_found") throw notFound("Notification introuvable.");
  if (outcome === "already_sent") {
    throw new ApiError(
      409,
      "already_sent",
      "Cette notification est déjà marquée comme envoyée.",
    );
  }
  if (outcome === "already_failed") {
    throw new ApiError(
      409,
      "already_failed",
      "Cet échec est déjà enregistré ; le back-office peut la remettre en file.",
    );
  }
  logSecurity({ type: "api_notification_failed", notificationId: id.data! });
  return json(call, { ok: true });
});
