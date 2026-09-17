import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { RECOVERY_CODE_LENGTH } from "@/domain/auth/types";

/*
 * Secrets à usage unique de la récupération de compte (Node, sans dépendance) :
 * - generateRecoveryCode : six chiffres tirés au hasard cryptographique
 *   (jamais Math.random), zéros de tête compris ;
 * - generateLinkToken : 32 octets aléatoires en base64url, pour un lien d'URL ;
 * - hashSecret : HMAC-SHA256 avec une clé serveur (AUTH_SECRET) : la base ne
 *   contient que ce HMAC, un vidage de la table ne permet ni de lire un code
 *   ni d'en forger un sans la clé ;
 * - secretsMatch : comparaison en temps constant de deux HMAC.
 */
export function generateRecoveryCode(): string {
  return String(randomInt(0, 10 ** RECOVERY_CODE_LENGTH)).padStart(
    RECOVERY_CODE_LENGTH,
    "0",
  );
}

export function generateLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string, key: string): string {
  return createHmac("sha256", key).update(secret).digest("hex");
}

export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
