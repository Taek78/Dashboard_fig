import {
  LONGEST_WINDOW_MS,
  recordFailure,
  type AttemptState,
  type LoginAttemptsSource,
} from "@/lib/rate-limit";

/*
 * Tentatives de connexion EN MÉMOIRE du processus (DATA_SOURCE=mock) : valable
 * pour un serveur unique, perdu au redémarrage. En mode db, la table
 * login_attempts prend le relais (login-attempts.db.ts) et l'état est partagé
 * entre instances. Conservé sur globalThis en développement pour survivre au
 * rechargement à chaud. Pas de server-only : Vitest charge ce module.
 */
declare global {
  var __figLoginAttempts: Map<string, AttemptState> | undefined;
}

const store: Map<string, AttemptState> = (globalThis.__figLoginAttempts ??=
  new Map());

const MAX_ENTRIES = 10_000;

export const loginAttemptsMock: LoginAttemptsSource = {
  async read(keys) {
    const found = new Map<string, AttemptState>();
    for (const key of keys) {
      const state = store.get(key);
      if (state) found.set(key, { ...state });
    }
    return found;
  },

  async recordFailure(entries, now) {
    for (const { key, policy } of entries) {
      store.set(key, recordFailure(store.get(key), now, policy));
    }
    prune(now);
  },

  async clear(keys) {
    for (const key of keys) store.delete(key);
  },
};

/** Oublie les entrées anciennes et non verrouillées quand le store grossit. */
function prune(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [key, state] of store) {
    const lockExpired = state.lockedUntil === null || state.lockedUntil <= now;
    if (lockExpired && now - state.lastFailureAt > LONGEST_WINDOW_MS) {
      store.delete(key);
    }
  }
}

/** Hors contrat : tests uniquement. */
export function resetLoginAttemptsMock(): void {
  store.clear();
}

/** Hors contrat : nombre d'entrées, pour tester la purge. */
export function loginAttemptsMockSize(): number {
  return store.size;
}
