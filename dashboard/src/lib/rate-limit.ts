/*
 * Limitation de débit des tentatives de connexion : règles PURES (aucun état,
 * aucune dépendance), testées. L'état par clé (e-mail, adresse IP) est stocké
 * par src/data/login-attempts.ts (mémoire ou table login_attempts selon
 * DATA_SOURCE) ; src/data/credentials.ts orchestre.
 *
 * Verrouillage progressif : à partir de `maxFailures` échecs rapprochés (moins
 * de `windowMs` entre deux échecs), chaque nouvel échec double la durée du
 * verrou, plafonnée à `maxLockMs`. Un succès efface tout.
 */
export type RateLimitPolicy = {
  /** Deux échecs séparés de plus que ce délai ne se cumulent pas. */
  windowMs: number;
  /** Nombre d'échecs à partir duquel on verrouille. */
  maxFailures: number;
  /** Premier verrou ; doublé à chaque échec suivant. */
  baseLockMs: number;
  maxLockMs: number;
};

const MINUTE = 60_000;

/** Par e-mail : serré, c'est la cible du bourrage d'identifiants. */
export const EMAIL_POLICY: RateLimitPolicy = {
  windowMs: 15 * MINUTE,
  maxFailures: 5,
  baseLockMs: 1 * MINUTE,
  maxLockMs: 60 * MINUTE,
};

/** Par adresse IP : plus large, une équipe partage souvent la même adresse. */
export const IP_POLICY: RateLimitPolicy = {
  windowMs: 15 * MINUTE,
  maxFailures: 20,
  baseLockMs: 1 * MINUTE,
  maxLockMs: 60 * MINUTE,
};

export type AttemptState = {
  failures: number;
  lastFailureAt: number;
  lockedUntil: number | null;
};

export type LimitDecision =
  { allowed: true } | { allowed: false; retryAfterMs: number };

/** Plus longue fenêtre des politiques : au-delà, un état sans verrou actif ne sert plus. */
export const LONGEST_WINDOW_MS = Math.max(
  EMAIL_POLICY.windowMs,
  IP_POLICY.windowMs,
);

/** Une clé surveillée (« email:… », « ip:… ») et la politique qui s'y applique. */
export type AttemptKey = { key: string; policy: RateLimitPolicy };

/**
 * Contrat du stockage des tentatives (src/data/login-attempts.{mock,db}.ts) :
 * en mémoire pour les fixtures, en base pour que plusieurs instances partagent
 * le même compteur. Le stockage lit et écrit ; les règles restent ici.
 * recordFailure applique recordFailure() à chaque clé de façon ATOMIQUE : deux
 * échecs simultanés comptent pour deux.
 */
export type LoginAttemptsSource = {
  read(keys: readonly string[]): Promise<Map<string, AttemptState>>;
  recordFailure(entries: readonly AttemptKey[], now: number): Promise<void>;
  clear(keys: readonly string[]): Promise<void>;
};

/** Le verrou est-il actif ? Sans état connu, tout est permis. */
export function checkAttempt(
  state: AttemptState | undefined,
  now: number,
): LimitDecision {
  if (!state || state.lockedUntil === null || state.lockedUntil <= now) {
    return { allowed: true };
  }
  return { allowed: false, retryAfterMs: state.lockedUntil - now };
}

/** Nouvel état après un échec : compteur, et verrou dès le seuil atteint. */
export function recordFailure(
  state: AttemptState | undefined,
  now: number,
  policy: RateLimitPolicy,
): AttemptState {
  const fresh = !state || now - state.lastFailureAt > policy.windowMs;
  const failures = fresh ? 1 : state.failures + 1;
  const overflow = failures - policy.maxFailures;
  const lockedUntil =
    overflow < 0
      ? null
      : now + Math.min(policy.baseLockMs * 2 ** overflow, policy.maxLockMs);
  return { failures, lastFailureAt: now, lockedUntil };
}

/** La décision la plus restrictive de plusieurs (e-mail ET adresse IP). */
export function strictest(decisions: readonly LimitDecision[]): LimitDecision {
  let worst: LimitDecision = { allowed: true };
  for (const d of decisions) {
    if (!d.allowed && (worst.allowed || d.retryAfterMs > worst.retryAfterMs)) {
      worst = d;
    }
  }
  return worst;
}

/** "1 minute", "3 minutes", "1 heure" : arrondi vers le haut, jamais « 0 minute ». */
export function formatRetryDelay(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE));
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} heure${hours > 1 ? "s" : ""}`;
}

/**
 * Adresse IP du client derrière un proxy inverse : première valeur de
 * X-Forwarded-For, sinon X-Real-IP, sinon "inconnue". Les en-têtes sont
 * falsifiables : la limite par IP est un filet, celle par e-mail la vraie garde.
 */
export function clientIpFrom(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  return real || "inconnue";
}
