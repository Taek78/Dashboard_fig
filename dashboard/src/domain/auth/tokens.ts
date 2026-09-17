import { RECOVERY_CODE_LENGTH } from "@/domain/auth/types";

/*
 * Jetons d'authentification (table auth_tokens), règles pures : trois sortes,
 * chacune avec sa validité et, pour le code, un nombre d'essais.
 * - recovery_code : le code à 6 chiffres envoyé par mail (« Mot de passe
 *   oublié »), 5 minutes, 5 essais, une nouvelle demande annule le précédent ;
 * - lock_link : le lien « Ce n'était pas moi » des mails de récupération,
 *   24 heures, plusieurs peuvent coexister (un par mail reçu) ;
 * - invitation : le lien pour choisir son mot de passe (création du compte par
 *   l'administrateur, ou lien envoyé à la demande), 48 heures, un seul actif.
 * Le secret (code ou jeton d'URL) n'est jamais stocké : seulement son HMAC
 * (src/lib/secrets.ts). Chaque jeton ne sert qu'une fois (consumedAt).
 */
export const AUTH_TOKEN_KINDS = [
  "recovery_code",
  "lock_link",
  "invitation",
] as const;
export type AuthTokenKind = (typeof AUTH_TOKEN_KINDS)[number];

export const AUTH_TOKEN_LABELS: Record<AuthTokenKind, string> = {
  recovery_code: "Code de récupération",
  lock_link: "Lien de verrouillage",
  invitation: "Lien d'invitation",
};

export type AuthTokenRule = {
  ttlMs: number;
  /** Essais autorisés avant annulation ; null = un lien ne se devine pas. */
  maxAttempts: number | null;
  /** Vrai si une nouvelle émission annule les jetons actifs de même sorte. */
  exclusive: boolean;
  /** Validité en français, pour les mails et les écrans. */
  validity: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const AUTH_TOKEN_RULES: Record<AuthTokenKind, AuthTokenRule> = {
  recovery_code: {
    ttlMs: 5 * MINUTE,
    maxAttempts: 5,
    exclusive: true,
    validity: "5 minutes",
  },
  lock_link: {
    ttlMs: 24 * HOUR,
    maxAttempts: null,
    exclusive: false,
    validity: "24 heures",
  },
  invitation: {
    ttlMs: 48 * HOUR,
    maxAttempts: null,
    exclusive: true,
    validity: "48 heures",
  },
};

export type AuthToken = {
  id: string;
  kind: AuthTokenKind;
  userId: string;
  /** HMAC du secret, jamais le secret. */
  secretHash: string;
  /** ISO 8601. */
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
  requestedIp: string | null;
  createdAt: string;
};

/** Utilisable : ni consommé, ni expiré, ni épuisé par les essais. */
export function isTokenUsable(
  token: Pick<AuthToken, "kind" | "expiresAt" | "attempts" | "consumedAt">,
  nowMs: number,
): boolean {
  if (token.consumedAt !== null) return false;
  if (Date.parse(token.expiresAt) <= nowMs) return false;
  const max = AUTH_TOKEN_RULES[token.kind].maxAttempts;
  return max === null || token.attempts < max;
}

export function tokenExpiresAt(kind: AuthTokenKind, nowMs: number): Date {
  return new Date(nowMs + AUTH_TOKEN_RULES[kind].ttlMs);
}

const CODE_PATTERN = new RegExp(`^\\d{${RECOVERY_CODE_LENGTH}}$`);

/** Six chiffres, rien d'autre. */
export function isRecoveryCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}
