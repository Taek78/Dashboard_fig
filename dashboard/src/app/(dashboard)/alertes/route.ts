import { getAlertFeed } from "@/data/alerts";
import { getCurrentUser } from "@/data/session";
import { alertScopeFor } from "@/domain/auth/roles";
import { alertSince } from "@/domain/alerts/schemas";
import { isCrossSiteRequest } from "@/lib/fetch-site";

/*
 * GET /alertes?depuis=<ISO> : le flux des alertes en direct, relevé toutes
 * les 5 s par AlertCenter (onglet visible seulement). Session obligatoire
 * (getCurrentUser) ; chaque liste est limitée à ce que le rôle peut ouvrir
 * (alertScopeFor) ; une requête d'un autre site est refusée. Réponse JSON
 * jamais mise en cache. Le proxy ne renouvelle jamais la session sur ce
 * chemin (session-refresh.ts) : un onglet ouvert qui relève ne doit pas
 * prolonger une session indéfiniment.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (isCrossSiteRequest(request.headers)) {
    return new Response("Accès refusé.", { status: 403, headers: NO_STORE });
  }
  const now = new Date();
  const since = alertSince(
    new URL(request.url).searchParams.get("depuis"),
    now,
  );
  const feed = await getAlertFeed(since, alertScopeFor(user.role), now);
  return Response.json(feed, { headers: NO_STORE });
}
