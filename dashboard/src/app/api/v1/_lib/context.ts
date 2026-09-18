import "server-only";
import { logSecurity } from "@/data/security-log";
import { RATE_LIMIT_PER_IP, RATE_LIMIT_PER_SESSION } from "@/domain/api/types";
import { corsHeaders } from "@/lib/api/cors";
import {
  ApiError,
  errorBody,
  internalError,
  rateLimited,
} from "@/lib/api/errors";
import { SlidingWindowLimiter } from "@/lib/api/throttle";
import { getEnv } from "@/lib/env";
import { clientIpFrom } from "@/lib/rate-limit";

/*
 * Cadre commun des routes de l'API (/api/v1) : ce que chaque handler reçoit
 * (ApiCall) et ce qui entoure son exécution.
 * - apiRoute(methods, fn) : adresse IP, horloge, origine ; limitation de
 *   débit par IP (en mémoire) ; toute ApiError levée devient sa réponse JSON,
 *   toute autre erreur un 500 sans détail (journalisée côté serveur) ; CORS
 *   sur liste blanche (API_CORS_ORIGINS) posé sur chaque réponse ;
 * - json(call, body, …) : réponse JSON avec `Cache-Control` (no-store par
 *   défaut : les réponses authentifiées ne doivent rester dans aucun cache) ;
 * - preflight(methods) : l'OPTIONS d'une route, pour un navigateur.
 * Les routes gardent la discipline des Server Actions : authentification →
 * validation → relecture → règle → écriture → journal.
 */
export type ApiCall<P = Record<string, never>> = {
  request: Request;
  params: P;
  ip: string;
  now: Date;
  origin: string | null;
};

/** Ce que Next appelle : la requête et, pour une route dynamique, ses paramètres (promesse). */
export type RouteHandler<P> = (
  request: Request,
  context?: { params: Promise<P> },
) => Promise<Response>;

export const NO_STORE = "private, no-store";

const ipLimiter = new SlidingWindowLimiter(RATE_LIMIT_PER_IP);
/** Partagé avec requireCustomer (auth.ts) : une fenêtre par session. */
export const sessionLimiter = new SlidingWindowLimiter(RATE_LIMIT_PER_SESSION);

function cors(origin: string | null, methods: readonly string[]) {
  return corsHeaders(origin, getEnv().API_CORS_ORIGINS ?? [], methods);
}

type JsonInit = {
  status?: number;
  headers?: Record<string, string>;
  /** Valeur de Cache-Control ; no-store par défaut. */
  cache?: string;
};

export function json(
  call: ApiCall<unknown> & { methods: readonly string[] },
  body: unknown,
  init: JsonInit = {},
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: {
      "Cache-Control": init.cache ?? NO_STORE,
      ...cors(call.origin, call.methods),
      ...init.headers,
    },
  });
}

/** Réponse JSON déjà sérialisée (catalogue : le texte sert aussi à l'ETag). */
export function jsonText(
  call: ApiCall<unknown> & { methods: readonly string[] },
  text: string,
  init: JsonInit = {},
): Response {
  return new Response(text, {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": init.cache ?? NO_STORE,
      ...cors(call.origin, call.methods),
      ...init.headers,
    },
  });
}

export function noContent(
  call: ApiCall<unknown> & { methods: readonly string[] },
  init: {
    headers?: Record<string, string>;
    cache?: string;
    status?: number;
  } = {},
): Response {
  return new Response(null, {
    status: init.status ?? 204,
    headers: {
      "Cache-Control": init.cache ?? NO_STORE,
      ...cors(call.origin, call.methods),
      ...init.headers,
    },
  });
}

export type RouteCall<P> = ApiCall<P> & { methods: readonly string[] };

export function apiRoute<P = Record<string, never>>(
  methods: readonly string[],
  fn: (call: RouteCall<P>) => Promise<Response>,
): RouteHandler<P> {
  return async (request, context) => {
    const origin = request.headers.get("origin");
    const ip = clientIpFrom(request.headers);
    const now = new Date();
    try {
      const decision = ipLimiter.hit(`ip:${ip}`, now.getTime());
      if (!decision.allowed) {
        logSecurity({ type: "api_rate_limited", subject: "ip", ip });
        throw rateLimited(decision.retryAfterMs);
      }
      const params = context ? await context.params : ({} as P);
      return await fn({ request, params, ip, now, origin, methods });
    } catch (error) {
      let apiError: ApiError;
      if (error instanceof ApiError) {
        apiError = error;
      } else {
        console.error(
          "[api]",
          { method: request.method, path: new URL(request.url).pathname, ip },
          error,
        );
        apiError = internalError();
      }
      return Response.json(errorBody(apiError), {
        status: apiError.status,
        headers: {
          "Cache-Control": NO_STORE,
          ...cors(origin, methods),
          ...apiError.headers,
        },
      });
    }
  };
}

/** Réponse à un OPTIONS de navigateur : les en-têtes CORS si l'origine est admise, sinon rien. */
export function preflight(methods: readonly string[]) {
  return async (request: Request): Promise<Response> =>
    new Response(null, {
      status: 204,
      headers: {
        Allow: [...methods, "OPTIONS"].join(", "),
        ...cors(request.headers.get("origin"), methods),
      },
    });
}
