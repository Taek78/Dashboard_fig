/*
 * Accès des clients de l'application à l'API, règles PURES :
 * - un CODE DE CONNEXION à six chiffres est envoyé par mail à l'adresse
 *   demandée (connue ou non : c'est aussi le chemin de l'inscription), valable
 *   dix minutes, cinq essais, un seul actif par adresse ; seul son HMAC est en
 *   base (customer_login_codes), comme les codes du back-office ;
 * - un code accepté ouvre une SESSION : jeton opaque de 32 octets remis une
 *   seule fois à l'application, HMAC en base (customer_sessions), 180 jours,
 *   révocable (déconnexion, anonymisation). Pas de mot de passe à garder.
 * - `lastSeenAt` n'est réécrit qu'au plus toutes les dix minutes : une lecture
 *   authentifiée ne coûte qu'une requête, pas une écriture.
 */
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const LOGIN_CODE_TTL_MS = 10 * MINUTE;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const LOGIN_CODE_VALIDITY = "10 minutes";
export const CUSTOMER_SESSION_TTL_MS = 180 * DAY;
export const SESSION_TOUCH_INTERVAL_MS = 10 * MINUTE;

export type CustomerLoginCode = {
  id: string;
  /** Adresse en minuscules, telle que saisie ; sans clé étrangère (inscription possible). */
  email: string;
  /** HMAC du code, jamais le code. */
  codeHash: string;
  attempts: number;
  /** ISO 8601. */
  expiresAt: string;
  consumedAt: string | null;
  requestedIp: string | null;
  createdAt: string;
};

export type CustomerSession = {
  id: string;
  customerId: string;
  /** HMAC du jeton, jamais le jeton. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

/** Utilisable : ni consommé, ni expiré, ni épuisé par les essais. */
export function isLoginCodeUsable(
  code: Pick<CustomerLoginCode, "expiresAt" | "attempts" | "consumedAt">,
  nowMs: number,
): boolean {
  return (
    code.consumedAt === null &&
    Date.parse(code.expiresAt) > nowMs &&
    code.attempts < LOGIN_CODE_MAX_ATTEMPTS
  );
}

/** Vivante : ni révoquée ni expirée. */
export function isSessionUsable(
  session: Pick<CustomerSession, "expiresAt" | "revokedAt">,
  nowMs: number,
): boolean {
  return session.revokedAt === null && Date.parse(session.expiresAt) > nowMs;
}

/** Vrai quand `lastSeenAt` mérite d'être réécrit (plus de dix minutes). */
export function sessionNeedsTouch(
  session: Pick<CustomerSession, "lastSeenAt">,
  nowMs: number,
): boolean {
  return nowMs - Date.parse(session.lastSeenAt) >= SESSION_TOUCH_INTERVAL_MS;
}

export function loginCodeExpiresAt(nowMs: number): Date {
  return new Date(nowMs + LOGIN_CODE_TTL_MS);
}

export function sessionExpiresAt(nowMs: number): Date {
  return new Date(nowMs + CUSTOMER_SESSION_TTL_MS);
}
