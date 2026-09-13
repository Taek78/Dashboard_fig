import "server-only";
import {
  checkLoginAllowed,
  clearLoginAttempts,
  recordLoginFailure,
} from "@/data/login-attempts";
import { findUserByEmail } from "@/data/users";
import type { Role } from "@/domain/auth/roles";
import { loginSchema } from "@/domain/auth/schemas";
import { dummyPasswordHash, verifyPassword } from "@/lib/password";
import { clientIpFrom } from "@/lib/rate-limit";
import { logSecurity } from "@/lib/security-log";

/*
 * Vérification d'un couple e-mail / mot de passe : le SEUL chemin, appelé par
 * authorize() d'Auth.js, que la demande vienne du formulaire (Server Action)
 * ou directement de la route HTTP /api/auth/callback/credentials. C'est donc
 * ici que vivent la limitation de débit et le journal, pas dans l'action.
 *
 * Ordre : zod → verrou (e-mail et IP, avant scrypt : un compte verrouillé ne
 * coûte rien) → vérification à coût constant (un e-mail inconnu vérifie un
 * hachage factice) → échec compté et journalisé, ou succès qui efface le
 * compteur. Renvoie null sans jamais dire pourquoi.
 */
export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export async function authorizeCredentials(
  credentials: unknown,
  headers: Headers,
): Promise<AuthorizedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const key = {
    email: parsed.data.email.toLowerCase(),
    ip: clientIpFrom(headers),
  };
  const now = Date.now();

  const decision = checkLoginAllowed(key, now);
  if (!decision.allowed) {
    logSecurity({
      type: "login_locked",
      ...key,
      retryAfterMs: decision.retryAfterMs,
    });
    return null;
  }

  const user = await findUserByEmail(parsed.data.email);
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? (await dummyPasswordHash()),
  );
  if (!user || !ok) {
    recordLoginFailure(key, now);
    logSecurity({ type: "login_failure", ...key });
    return null;
  }

  clearLoginAttempts(key);
  logSecurity({ type: "login_success", ...key });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
