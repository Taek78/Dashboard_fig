/*
 * CORS de l'API, règle pure : un navigateur n'appelle l'API que depuis une
 * origine de la liste blanche (API_CORS_ORIGINS). Sans liste, aucun en-tête :
 * une application native (iOS, Android) n'en a pas besoin, et un site tiers
 * n'obtient rien. `Vary: Origin` empêche un cache de resservir la réponse
 * d'une origine à une autre.
 */
export const CORS_ALLOWED_HEADERS =
  "Authorization, Content-Type, Idempotency-Key, If-None-Match";
export const CORS_EXPOSED_HEADERS = "ETag, Retry-After, Idempotent-Replayed";
const PREFLIGHT_MAX_AGE_S = 600;

export function corsHeaders(
  origin: string | null,
  allowed: readonly string[],
  methods: readonly string[],
): Record<string, string> {
  if (origin === null || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": [...methods, "OPTIONS"].join(", "),
    "Access-Control-Allow-Headers": CORS_ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": CORS_EXPOSED_HEADERS,
    "Access-Control-Max-Age": String(PREFLIGHT_MAX_AGE_S),
    Vary: "Origin",
  };
}
