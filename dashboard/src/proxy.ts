import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import type { Session } from "next-auth";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { canViewSection, homeFor } from "@/domain/auth/roles";
import { cspFor } from "@/lib/csp";
import { getEnv } from "@/lib/env";
import {
  isBackgroundPoll,
  isPrefetch,
  refreshDue,
  SESSION_COOKIE_NAMES,
  stripSessionCookies,
} from "@/lib/session-refresh";

/*
 * Proxy (le middleware de Next 16, runtime Node.js) : première barrière, avant
 * toute page. Sur chaque requête (sauf assets) :
 * 1. un nonce est tiré, posé dans la CSP de la réponse et transmis à la page
 *    (en-tête x-nonce) ; Next applique ce nonce à ses scripts, le layout au
 *    script du thème ;
 * 2. hors chemins publics (connexion, routes Auth.js, santé) : anonyme →
 *    redirection vers /connexion?callbackUrl= ; rôle sans accès à la section
 *    (matrice SECTION_ACCESS) → redirection vers la page d'accueil du rôle ;
 * 3. le cookie de session qu'Auth.js re-pose à chaque réponse est retiré
 *    quand le rafraîchissement n'a pas lieu d'être (préchargement, relevé des
 *    alertes en tâche de fond, jeton récent) : sinon une réponse en vol après la déconnexion reconnecterait
 *    la personne (src/lib/session-refresh.ts).
 * Les pages revérifient de toute façon via verifySession() et les Server
 * Actions relisent le rôle : le proxy évite juste de rendre quoi que ce soit.
 *
 * Next exige un export nommé `proxy` qui soit une vraie fonction. Notre config
 * Auth.js est paresseuse : `auth(garde)` renvoie alors une promesse de
 * middleware, qu'on attend avant de l'appeler. Avec une garde fournie, Auth.js
 * ne redirige plus lui-même les anonymes : la garde s'en charge.
 */
type AuthedRequest = NextRequest & { auth: Session | null };
type Guard = (
  request: AuthedRequest,
  event: NextFetchEvent,
) => Response | undefined;
type Middleware = (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;
type AuthWrapper = (guard: Guard) => Middleware | Promise<Middleware>;

const withAuth = auth as unknown as AuthWrapper;

// /api/v1 : l'API de l'application FIG, qui fait sa propre authentification
// (jeton de session du client ou clé de service), sans cookie ni redirection.
const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/api/v1", "/connexion"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function guard(request: AuthedRequest): Response {
  const { pathname } = request.nextUrl;
  const role = request.auth?.user?.role;

  if (!isPublic(pathname)) {
    if (!role) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = "/connexion";
      signInUrl.search = "";
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }
    if (!canViewSection(role, pathname)) {
      return NextResponse.redirect(new URL(homeFor(role), request.nextUrl));
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = cspFor(pathname, nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/** Ne laisse Auth.js re-poser le cookie de session que si c'est utile. */
async function limitSessionRefresh(
  request: NextRequest,
  response: Response,
): Promise<void> {
  const cookieName = SESSION_COOKIE_NAMES.find((name) =>
    request.cookies.has(name),
  );
  if (!cookieName) return;
  if (
    isPrefetch(request.headers) ||
    isBackgroundPoll(request.nextUrl.pathname)
  ) {
    stripSessionCookies(response.headers);
    return;
  }
  const token = await getToken({
    req: request,
    secret: getEnv().AUTH_SECRET,
    salt: cookieName,
    cookieName,
  }).catch(() => null);
  if (!refreshDue(token?.exp, Date.now())) {
    stripSessionCookies(response.headers);
  }
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const middleware = await withAuth(guard);
  const response = await middleware(request, event);
  await limitSessionRefresh(request, response);
  return response;
}

export const config = {
  // fond/ : images décoratives publiques (public/fond), sans donnée : servies sans garde,
  // sinon un masque CSS reçoit la redirection vers /connexion au lieu du SVG.
  // api/v1/ : l'API de l'application, appelée bien plus souvent que les pages ;
  // elle authentifie elle-même (jeton de session ou clé de service) et ne rend
  // aucun HTML, donc ni nonce ni CSP à poser, ni cookie de session à relire.
  // La laisser hors du proxy lui épargne ce travail à chaque appel ; elle reste
  // par sécurité dans PUBLIC_PREFIXES, au cas où le matcher changerait.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fond/|api/v1/).*)"],
};
