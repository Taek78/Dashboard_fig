import type { ApiErrorBody } from "@/domain/api/responses";

/*
 * Erreurs de l'API, règles pures : une classe portée jusqu'au bord de la
 * route (apiRoute l'attrape) et un corps JSON uniforme
 * `{ error: { code, message, details? } }`. Les codes sont STABLES (en
 * snake_case : l'application les teste), les messages en français (elle peut
 * les afficher tels quels). Jamais de valeur reçue reflétée, jamais de pile.
 */
export const API_ERROR_CODES = [
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "method_not_allowed",
  "conflict",
  "payload_too_large",
  "unsupported_media_type",
  "validation_failed",
  "rate_limited",
  "idempotency_key_required",
  "idempotency_key_reused",
  "idempotency_in_progress",
  "code_invalid",
  "code_locked",
  "signup_required",
  "email_taken",
  "referral_code_unknown",
  "community_not_joinable",
  "account_closed",
  "quote_invalid",
  "slot_unavailable",
  "address_required",
  "total_mismatch",
  "not_cancellable",
  "order_not_owned",
  "already_sent",
  "length_required",
  "file_empty",
  "content_type_mismatch",
  "upload_quota_exceeded",
  "attachment_unavailable",
  "service_unavailable",
  "internal_error",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { details?: unknown; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export function errorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
}

/* Raccourcis des cas fréquents, avec leur message figé. */
export const unauthenticated = () =>
  new ApiError(
    401,
    "unauthenticated",
    "Jeton de session absent, invalide ou expiré : reconnectez-vous.",
    { headers: { "WWW-Authenticate": "Bearer" } },
  );

export const forbidden = (message = "Accès refusé.") =>
  new ApiError(403, "forbidden", message);

export const notFound = (message = "Ressource introuvable.") =>
  new ApiError(404, "not_found", message);

export const rateLimited = (retryAfterMs: number) =>
  new ApiError(
    429,
    "rate_limited",
    "Trop de requêtes : réessayez dans un instant.",
    {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    },
  );

export const internalError = () =>
  new ApiError(
    500,
    "internal_error",
    "Une erreur interne s'est produite. Réessayez dans un instant.",
  );
