import "server-only";
import { findSession, touchSession } from "@/data/api-auth";
import { logSecurity } from "@/data/security-log";
import {
  isSessionUsable,
  sessionNeedsTouch,
  type CustomerSession,
} from "@/domain/api/session";
import type { AuthenticatedCustomer } from "@/domain/api/source";
import { ApiError, rateLimited, unauthenticated } from "@/lib/api/errors";
import { bearerToken } from "@/lib/api/request";
import { getEnv } from "@/lib/env";
import { hashSecret, secretsMatch } from "@/lib/secrets";
import { sessionLimiter, type ApiCall } from "@/app/api/v1/_lib/context";

/*
 * Authentification des routes de l'API.
 * - requireCustomer : jeton « Authorization: Bearer » → HMAC → session et
 *   client joints en une requête ; refus si absent, expiré, révoqué (401) ou
 *   si le compte a été anonymisé (403 account_closed). La limitation de débit
 *   par session s'applique AVANT la lecture en base (clé : le HMAC, jamais le
 *   jeton). `last_seen_at` n'est réécrit qu'au plus toutes les dix minutes.
 * - requireService : la clé du serveur de l'application (API_SERVICE_KEY),
 *   comparée à temps constant ; 503 tant qu'elle n'est pas configurée.
 */
export type CustomerContext = {
  session: CustomerSession;
  customer: AuthenticatedCustomer;
};

export async function requireCustomer(
  call: ApiCall<unknown>,
): Promise<CustomerContext> {
  const token = bearerToken(call.request);
  if (!token) throw unauthenticated();
  const tokenHash = hashSecret(token, getEnv().AUTH_SECRET);
  const nowMs = call.now.getTime();
  const decision = sessionLimiter.hit(`session:${tokenHash}`, nowMs);
  if (!decision.allowed) {
    logSecurity({ type: "api_rate_limited", subject: "session", ip: call.ip });
    throw rateLimited(decision.retryAfterMs);
  }
  const found = await findSession(tokenHash);
  if (!found || !isSessionUsable(found.session, nowMs)) throw unauthenticated();
  if (found.customer.anonymized) {
    throw new ApiError(
      403,
      "account_closed",
      "Ce compte a été clôturé : ses données ont été effacées.",
    );
  }
  if (sessionNeedsTouch(found.session, nowMs)) {
    await touchSession(found.session.id, call.now);
  }
  return found;
}

export function requireService(call: ApiCall<unknown>): void {
  const key = getEnv().API_SERVICE_KEY;
  if (!key) {
    throw new ApiError(
      503,
      "service_unavailable",
      "Clé de service non configurée sur ce serveur (API_SERVICE_KEY).",
    );
  }
  const token = bearerToken(call.request);
  if (!token || !secretsMatch(token, key)) {
    logSecurity({ type: "api_service_forbidden", ip: call.ip });
    throw unauthenticated();
  }
}
