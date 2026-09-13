import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { canViewSection, homeFor } from "@/domain/auth/roles";

/*
 * Proxy (ex-middleware, Next 16, runtime Node.js) : première barrière, avant
 * toute page. Deux décisions, à partir de la session lue par Auth.js :
 * 1. anonyme → redirection vers /connexion?callbackUrl= ;
 * 2. rôle sans accès à la section demandée (matrice SECTION_ACCESS) →
 *    redirection vers la page d'accueil de ce rôle.
 * Les pages revérifient de toute façon via verifySession() et les Server
 * Actions relisent le rôle : le proxy évite juste de rendre quoi que ce soit.
 *
 * Next exige un export nommé `proxy` qui soit une vraie fonction. Notre config
 * Auth.js est paresseuse : `auth(garde)` renvoie alors une promesse de
 * middleware, qu'on attend avant de l'appeler. Avec une garde fournie, Auth.js
 * ne redirige plus lui-même les anonymes : la garde s'en charge (cas 1).
 * Le type de `auth` est une union de toutes ses formes d'appel ; on fixe ici
 * celle de l'enveloppe de middleware.
 *
 * Exclus du matcher : les routes Auth.js, la santé, la page de connexion, les
 * assets Next.
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

function guard(request: AuthedRequest): Response | undefined {
  const role = request.auth?.user?.role;
  if (!role) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/connexion";
    signInUrl.search = "";
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }
  if (!canViewSection(role, request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(homeFor(role), request.nextUrl));
  }
  return undefined;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const middleware = await withAuth(guard);
  return middleware(request, event);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|connexion|_next/static|_next/image|favicon.ico).*)",
  ],
};
