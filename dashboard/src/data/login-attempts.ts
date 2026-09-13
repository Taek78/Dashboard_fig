import "server-only";
import {
  checkAttempt,
  EMAIL_POLICY,
  IP_POLICY,
  recordFailure,
  strictest,
  type AttemptState,
  type LimitDecision,
} from "@/lib/rate-limit";

/*
 * État des tentatives de connexion, en mémoire du processus : suffisant pour
 * un serveur unique (le cas prévu) ; à porter en base ou dans un cache partagé
 * si le dashboard tourne un jour sur plusieurs instances. Conservé sur
 * globalThis en développement pour survivre au rechargement à chaud.
 * Les règles (seuils, verrous) sont dans src/lib/rate-limit.ts.
 */
type LoginKey = { email: string; ip: string };

declare global {
  var __figLoginAttempts: Map<string, AttemptState> | undefined;
}

const store: Map<string, AttemptState> = (globalThis.__figLoginAttempts ??=
  new Map());

const MAX_ENTRIES = 10_000;

const keys = ({ email, ip }: LoginKey) => ({
  email: `email:${email.toLowerCase()}`,
  ip: `ip:${ip}`,
});

export function checkLoginAllowed(key: LoginKey, now: number): LimitDecision {
  const k = keys(key);
  return strictest([
    checkAttempt(store.get(k.email), now),
    checkAttempt(store.get(k.ip), now),
  ]);
}

export function recordLoginFailure(key: LoginKey, now: number): void {
  const k = keys(key);
  store.set(k.email, recordFailure(store.get(k.email), now, EMAIL_POLICY));
  store.set(k.ip, recordFailure(store.get(k.ip), now, IP_POLICY));
  prune(now);
}

export function clearLoginAttempts(key: LoginKey): void {
  const k = keys(key);
  store.delete(k.email);
  store.delete(k.ip);
}

/** Oublie les entrées anciennes et non verrouillées quand le store grossit. */
function prune(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [key, state] of store) {
    const lockExpired = state.lockedUntil === null || state.lockedUntil <= now;
    if (lockExpired && now - state.lastFailureAt > EMAIL_POLICY.windowMs) {
      store.delete(key);
    }
  }
}

/** Hors contrat : tests uniquement. */
export function resetLoginAttempts(): void {
  store.clear();
}
