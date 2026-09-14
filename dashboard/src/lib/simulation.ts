/*
 * Mode de simulation des états « vide » et « erreur », en développement seulement.
 *
 * Fonction pure plutôt qu'un `if` dans la page : la page lui passe `isDev`
 * (calculé depuis process.env.NODE_ENV) et le paramètre d'URL brut ; la fonction
 * ne lit rien elle-même, donc elle est testable, et le cas qui compte
 * (`("erreur", false)` → null, jamais actif en production) est verrouillé par un
 * test. La source de données ne connaît pas la simulation : la page substitue []
 * ou lève AVANT d'appeler getOrders().
 */
export type SimulationMode = "vide" | "erreur";

/**
 * `raw` a le type que Next donne à une valeur de searchParams : chaîne, tableau
 * (paramètre répété) ou undefined. L'entrée est hostile ; la sortie est étroite.
 */
export function readSimulationMode(
  raw: string | string[] | undefined,
  isDev: boolean,
): SimulationMode | null {
  if (!isDev) return null;
  if (Array.isArray(raw)) return null;
  if (raw === "vide" || raw === "erreur") return raw;
  return null;
}
