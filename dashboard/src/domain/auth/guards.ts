/*
 * Garde pure de la session mock.
 *
 * Pourquoi elle est ici (src/domain) et pas dans src/data/session.ts : session.ts est
 * server-only, donc intestable sous Vitest. La règle « autorisé seulement en
 * development ou test » est isolée dans une fonction pure qui reçoit nodeEnv en
 * paramètre, et session.ts ne fait que l'appeler avec process.env.NODE_ENV.
 *
 * Liste blanche plutôt que `=== "production"` : une valeur inattendue (undefined,
 * "staging"…) tombe du côté sûr.
 *
 * À écrire ici :
 *   export function assertMockSessionAllowed(nodeEnv: string | undefined): void
 *   → const allowed = nodeEnv === "development" || nodeEnv === "test";
 *     if (!allowed) throw new Error("Session mock interdite hors development/test");
 */

//Sécurité : la session mock ne doit jamais être utilisée hors dev/test.
export function assertMockSessionAllowed(nodeEnv: string | undefined): void {
  const allowed = nodeEnv === "development" || nodeEnv === "test";
  if (!allowed) {
    throw new Error("Session mock interdite hors development/test");
  }
}
