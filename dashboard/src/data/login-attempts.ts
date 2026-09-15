import "server-only";
import { loginAttemptsDb } from "@/data/login-attempts.db";
import {
  checkAttempt,
  EMAIL_POLICY,
  IP_POLICY,
  strictest,
  type LimitDecision,
} from "@/lib/rate-limit";

/*
 * Façade des tentatives de connexion : clés (e-mail, adresse IP) et décision.
 * L'état est dans la table login_attempts (login-attempts.db.ts), partagé entre
 * instances et conservé au redémarrage. Les règles sont dans
 * src/lib/rate-limit.ts.
 */
type LoginKey = { email: string; ip: string };

const keysOf = ({ email, ip }: LoginKey) => ({
  email: `email:${email.toLowerCase()}`,
  ip: `ip:${ip}`,
});

export async function checkLoginAllowed(
  key: LoginKey,
  now: number,
): Promise<LimitDecision> {
  const k = keysOf(key);
  const states = await loginAttemptsDb.read([k.email, k.ip]);
  return strictest([
    checkAttempt(states.get(k.email), now),
    checkAttempt(states.get(k.ip), now),
  ]);
}

export async function recordLoginFailure(
  key: LoginKey,
  now: number,
): Promise<void> {
  const k = keysOf(key);
  await loginAttemptsDb.recordFailure(
    [
      { key: k.email, policy: EMAIL_POLICY },
      { key: k.ip, policy: IP_POLICY },
    ],
    now,
  );
}

export async function clearLoginAttempts(key: LoginKey): Promise<void> {
  const k = keysOf(key);
  await loginAttemptsDb.clear([k.email, k.ip]);
}
