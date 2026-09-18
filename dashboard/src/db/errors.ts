/*
 * Lecture des erreurs PostgreSQL remontées par Drizzle et postgres.js, pure.
 * Drizzle enveloppe l'erreur du pilote (DrizzleQueryError, `cause`) : on
 * descend la chaîne des causes jusqu'au code SQLSTATE et au nom de la
 * contrainte. Sert aux écritures qui réessaient sur une collision d'unicité
 * (référence de commande, code de parrainage) ou la traduisent en résultat
 * métier (adresse déjà inscrite).
 */
const UNIQUE_VIOLATION = "23505";

type PgErrorLike = {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
};

/** Vrai si l'erreur (ou une de ses causes) est une violation d'unicité sur la contrainte ou l'index nommé. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    const e = current as PgErrorLike;
    if (e.code === UNIQUE_VIOLATION && e.constraint_name === constraint) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
