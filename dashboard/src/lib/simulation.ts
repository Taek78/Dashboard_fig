/*
 * Mode de simulation des états « vide » et « erreur », en développement seulement.
 *
 * Pourquoi une fonction pure dans src/lib plutôt qu'un `if` dans la page : la page
 * lui passe `isDev` (calculé depuis process.env.NODE_ENV) et le paramètre d'URL brut ;
 * la fonction ne lit rien elle-même, donc elle est testable, et le cas qui compte
 * (`("erreur", false)` → null, jamais actif en production) est verrouillé par un test.
 * La source de données ne connaît pas la simulation : la page substitue [] ou lève
 * AVANT d'appeler getOrders().
 *
 * À écrire ici :
 *   - export type SimulationMode = "vide" | "erreur"
 *   - export function readSimulationMode(
 *       raw: string | string[] | undefined, isDev: boolean,
 *     ): SimulationMode | null
 *     → !isDev ⇒ null (vérifié EN PREMIER) ; Array.isArray(raw) ⇒ null ;
 *       "vide" | "erreur" ⇒ la valeur ; tout le reste ⇒ null.
 */

export type SimulationMode = "vide" | "erreur";

// `raw` a le type que Next donne à chaque valeur de searchParams :
//   string      → ?simuler=vide
//   string[]    → ?simuler=vide&simuler=erreur (paramètre répété)
//   undefined   → pas de paramètre
// On accepte l'entrée telle qu'elle arrive (hostile, non filtrée) et on la réduit
// à un type étroit en sortie : c'est le rôle d'une frontière de confiance.
export function readSimulationMode(
  raw: string | string[] | undefined,
  isDev: boolean,
): SimulationMode | null {
  if (!isDev) return null;
  if (Array.isArray(raw)) return null;
  if (raw === "vide" || raw === "erreur") return raw;
  return null;
}
