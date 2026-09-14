import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { canViewSection, homeFor } from "@/domain/auth/roles";
import { buildCsp } from "@/lib/csp";

/*
 * Proxy (ex-middleware, Next 16, runtime Node.js) : première barrière, avant
 * toute page. Sur chaque requête (sauf assets) :
 * 1. un nonce est tiré, posé dans la CSP de la réponse et transmis à la page
 *    (en-tête x-nonce) ; Next applique ce nonce à ses scripts, le layout au
 *    script du thème ;
 * 2. hors chemins publics (connexion, routes Auth.js, santé) : anonyme →
 *    redirection vers /connexion?callbackUrl= ; rôle sans accès à la section
 *    (matrice SECTION_ACCESS) → redirection vers la page d'accueil du rôle.
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

const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/connexion"];

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
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const middleware = await withAuth(guard);
  return middleware(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
