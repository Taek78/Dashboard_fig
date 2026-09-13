import type { NextFetchEvent, NextRequest } from "next/server";
import { auth } from "@/auth";

/*
 * Proxy (ex-middleware, Next 16, runtime Node.js) : première barrière. Toute
 * requête vers le back-office sans session valide est redirigée vers /connexion
 * (décision prise par callbacks.authorized dans src/auth.ts, redirection faite
 * par Auth.js avec ?callbackUrl=). Les pages revérifient de toute façon via
 * verifySession() : le proxy évite juste de rendre quoi que ce soit à un anonyme.
 *
 * Next exige un export nommé `proxy` qui soit une vraie fonction ; comme notre
 * config Auth.js est paresseuse, `auth` est asynchrone et `auth(fn)` renverrait
 * une promesse : on délègue donc explicitement avec la requête. Le type de `auth`
 * est une union de toutes ses formes d'appel ; on fixe ici celle du middleware.
 *
 * Exclus du matcher : les routes Auth.js, la page de connexion, les assets Next.
 */
type AuthMiddleware = (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

const authMiddleware = auth as unknown as AuthMiddleware;

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|connexion|_next/static|_next/image|favicon.ico).*)",
  ],
};
