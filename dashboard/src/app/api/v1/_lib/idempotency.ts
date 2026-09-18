import "server-only";
import { createHash } from "node:crypto";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} from "@/data/api-idempotency";
import { idempotencyKeySchema } from "@/domain/api/schemas";
import { IDEMPOTENCY_TTL_MS } from "@/domain/api/types";
import { ApiError } from "@/lib/api/errors";
import { validationFailed } from "@/lib/api/request";
import { json, type RouteCall } from "@/app/api/v1/_lib/context";

/*
 * Idempotence des créations (commande, message) : l'en-tête Idempotency-Key
 * est OBLIGATOIRE. Une clé jamais vue est prise avant le traitement ; la même
 * clé avec le même corps rejoue la réponse mémorisée (en-tête
 * Idempotent-Replayed) ; la même clé avec un autre corps est refusée ; une clé
 * en cours de traitement (deux envois simultanés) répond 409. Un traitement
 * qui échoue rend la clé : l'application peut réessayer. Un réseau mobile qui
 * coupe après l'envoi ne crée donc jamais deux commandes.
 */
export async function withIdempotency(
  call: RouteCall<unknown>,
  customerId: string,
  bodyText: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const header = call.request.headers.get("idempotency-key");
  if (header === null || header.trim() === "") {
    throw new ApiError(
      400,
      "idempotency_key_required",
      "L'en-tête Idempotency-Key est obligatoire pour cette création.",
    );
  }
  const parsed = idempotencyKeySchema.safeParse(header);
  if (!parsed.success)
    throw validationFailed(parsed.error, "Idempotency-Key invalide.");
  const key = parsed.data;
  const requestHash = createHash("sha256")
    .update(bodyText, "utf8")
    .digest("hex");

  const claim = await claimIdempotencyKey({
    customerId,
    key,
    requestHash,
    now: call.now,
    ttlMs: IDEMPOTENCY_TTL_MS,
  });
  if (claim.state === "replay") {
    return json(call, claim.body, {
      status: claim.status,
      headers: { "Idempotent-Replayed": "true" },
    });
  }
  if (claim.state === "in_progress") {
    throw new ApiError(
      409,
      "idempotency_in_progress",
      "Une requête portant la même clé est en cours de traitement.",
    );
  }
  if (claim.state === "mismatch") {
    throw new ApiError(
      422,
      "idempotency_key_reused",
      "Cette clé d'idempotence a déjà servi pour un autre corps de requête.",
    );
  }

  try {
    const result = await run();
    await completeIdempotencyKey({
      customerId,
      key,
      status: result.status,
      body: result.body,
    });
    return json(call, result.body, { status: result.status });
  } catch (error) {
    await releaseIdempotencyKey(customerId, key).catch(
      (releaseError: unknown) => {
        console.error("[api] clé d'idempotence non rendue", releaseError);
      },
    );
    throw error;
  }
}
