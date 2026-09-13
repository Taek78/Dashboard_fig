import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail } from "@/data/users";
import type { Role } from "@/domain/auth/roles";
import { loginSchema } from "@/domain/auth/schemas";
import { getEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

/*
 * Configuration Auth.js v5 (A7) : fournisseur Credentials (e-mail + mot de
 * passe), session en JWT signé par AUTH_SECRET dans un cookie HttpOnly, page de
 * connexion /connexion. La config est une fonction : elle n'est évaluée qu'à la
 * première requête, donc `next build` ne réclame pas l'environnement.
 *
 * authorize() renvoie null (jamais de détail) quand l'e-mail est inconnu OU le
 * mot de passe faux : un attaquant ne doit pas pouvoir distinguer les deux cas.
 * Le rôle est copié dans le jeton à la connexion (callback jwt) puis exposé à
 * l'app (callback session) : verifySession() le lit sans toucher à la source.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  secret: getEnv().AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user) return null;
        const ok = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
        if (!ok) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Lu par le proxy : sans utilisateur en session, Auth.js redirige vers pages.signIn.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
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
