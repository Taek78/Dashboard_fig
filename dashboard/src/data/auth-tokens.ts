import "server-only";
import { authTokensDb } from "@/data/auth-tokens.db";
import type { AuthTokensSource } from "@/domain/auth/source";
import {
  isTokenUsable,
  type AuthToken,
  type AuthTokenKind,
} from "@/domain/auth/tokens";
import { getEnv } from "@/lib/env";
import { hashSecret } from "@/lib/secrets";

/*
 * FAÇADE des jetons d'authentification (codes de récupération, liens de
 * verrouillage et d'invitation) : le seul module que les Server Actions et
 * les pages importent. Implémentation PostgreSQL dans auth-tokens.db.ts.
 *
 * findUsableLink : le jeton d'un lien d'URL (secret en clair) s'il est encore
 * utilisable, sinon null ; il hache le secret avec AUTH_SECRET et lit
 * l'horloge ici plutôt que dans une page (un composant serveur doit rester
 * pur : pas de Date.now() pendant le rendu). L'affichage ne consomme rien.
 */
export const {
  createToken,
  findActiveToken,
  findTokenByHash,
  recordTokenAttempt,
  consumeToken,
}: AuthTokensSource = authTokensDb;

const MIN_SECRET_LENGTH = 20;

export async function findUsableLink(
  kind: AuthTokenKind,
  secret: string,
): Promise<AuthToken | null> {
  if (secret.length < MIN_SECRET_LENGTH) return null;
  const token = await authTokensDb.findTokenByHash(
    kind,
    hashSecret(secret, getEnv().AUTH_SECRET),
  );
  return token && isTokenUsable(token, Date.now()) ? token : null;
}
