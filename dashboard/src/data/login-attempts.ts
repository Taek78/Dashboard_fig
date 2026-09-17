import "server-only";
import { loginAttemptsDb } from "@/data/login-attempts.db";
import {
  checkAttempt,
  EMAIL_POLICY,
  IP_POLICY,
  RECOVERY_IP_POLICY,
  RECOVERY_SUBJECT_POLICY,
  strictest,
  type LimitDecision,
} from "@/lib/rate-limit";

/*
 * Façade des tentatives de connexion : clés (e-mail, adresse IP) et décision.
 * L'état est dans la table login_attempts (login-attempts.db.ts), partagé entre
 * instances et conservé au redémarrage. Les règles sont dans
 * src/lib/rate-limit.ts.
 *
 * La même table porte les QUOTAS des pages publiques de récupération
 * (checkQuota / recordQuotaUse) : chaque demande de code ou de rappel
 * d'adresse compte comme un échec pour son sujet (e-mail ou nom saisi) et
 * pour l'adresse IP, avec les politiques RECOVERY_*. Les clés sont préfixées
 * par leur portée : un verrou de récupération ne bloque pas la connexion.
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

/* ---------- Quotas des pages publiques de récupération ---------- */

export type QuotaScope = "recovery" | "reminder";

const quotaKeysOf = (scope: QuotaScope, subject: string, ip: string) => ({
  subject: `${scope}:subject:${subject.trim().toLowerCase()}`,
  ip: `${scope}:ip:${ip}`,
});

export async function checkQuota(
  scope: QuotaScope,
  subject: string,
  ip: string,
  now: number,
): Promise<LimitDecision> {
  const k = quotaKeysOf(scope, subject, ip);
  const states = await loginAttemptsDb.read([k.subject, k.ip]);
  return strictest([
    checkAttempt(states.get(k.subject), now),
    checkAttempt(states.get(k.ip), now),
  ]);
}

export async function recordQuotaUse(
  scope: QuotaScope,
  subject: string,
  ip: string,
  now: number,
): Promise<void> {
  const k = quotaKeysOf(scope, subject, ip);
  await loginAttemptsDb.recordFailure(
    [
      { key: k.subject, policy: RECOVERY_SUBJECT_POLICY },
      { key: k.ip, policy: RECOVERY_IP_POLICY },
    ],
    now,
  );
}
