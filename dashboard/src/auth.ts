import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "@/data/credentials";
import type { Role } from "@/domain/auth/roles";
import { getEnv } from "@/lib/env";

/*
 * Configuration Auth.js v5 : fournisseur Credentials (e-mail + mot de
 * passe), session en JWT signé par AUTH_SECRET dans un cookie HttpOnly, page de
 * connexion /connexion. La config est une fonction : elle n'est évaluée qu'à la
 * première requête, donc `next build` ne réclame pas l'environnement.
 *
 * authorize() délègue à authorizeCredentials (src/data/credentials.ts) :
 * limitation de débit, coût constant, journal, et null sans détail quand
 * l'e-mail est inconnu OU le mot de passe faux. Le rôle est copié dans le jeton
 * à la connexion (callback jwt) puis exposé à l'app (callback session) :
 * verifySession() le lit sans toucher à la source.
 *
 * trustHost n'est pas fixé : Auth.js le déduit lui-même (vrai en développement,
 * vrai en production seulement si AUTH_URL est posée, et AUTH_URL devient alors
 * l'origine canonique : l'en-tête Host du client n'est plus cru). env-schema
 * exige AUTH_URL en production. La garde d'accès (anonymes, sections par rôle)
 * vit dans src/proxy.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: getEnv().AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials, request) =>
        authorizeCredentials(credentials, request.headers),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id ?? "");
      session.user.role = token.role as Role;
      return session;
    },
  },
}));
