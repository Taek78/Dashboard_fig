import "server-only";
import { loginAttemptsDb } from "@/data/login-attempts.db";
import { loginAttemptsMock } from "@/data/login-attempts.mock";
import { selectSource } from "@/data/select-source";
import {
  checkAttempt,
  EMAIL_POLICY,
  IP_POLICY,
  strictest,
  type LimitDecision,
} from "@/lib/rate-limit";

/*
 * Façade des tentatives de connexion : clés (e-mail, adresse IP) et décision.
 * Le stockage suit DATA_SOURCE comme les autres domaines : en mémoire en mode
 * mock (serveur unique), dans la table login_attempts en mode db (partagé entre
 * instances, conservé au redémarrage). Choisi au moment de l'appel, jamais au
 * chargement du module. Les règles sont dans src/lib/rate-limit.ts.
 */
type LoginKey = { email: string; ip: string };

const source = () =>
  selectSource("tentatives de connexion", loginAttemptsMock, loginAttemptsDb);

const keysOf = ({ email, ip }: LoginKey) => ({
  email: `email:${email.toLowerCase()}`,
  ip: `ip:${ip}`,
});

export async function checkLoginAllowed(
  key: LoginKey,
  now: number,
): Promise<LimitDecision> {
  const k = keysOf(key);
  const states = await source().read([k.email, k.ip]);
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
  await source().recordFailure(
    [
      { key: k.email, policy: EMAIL_POLICY },
      { key: k.ip, policy: IP_POLICY },
    ],
    now,
  );
}

export async function clearLoginAttempts(key: LoginKey): Promise<void> {
  const k = keysOf(key);
  await source().clear([k.email, k.ip]);
}
