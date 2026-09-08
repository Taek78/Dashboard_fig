/*
 * Rôles du back-office et règles d'autorisation pures.
 *
 * Pourquoi un domaine auth séparé des commandes : les rôles seront consultés par
 * toutes les Server Actions (commandes, catalogue, clients…). Les règles
 * `canXxx(role)` sont pures et testées ici ; les actions les appellent après avoir
 * relu la session côté serveur, jamais en faisant confiance au client.
 *
 * Vocabulaire provisoire (question Q5 au client).
 *
 * À écrire ici :
 *   - export const ROLES = ["admin", "gestionnaire", "lecture"] as const
 *   - export type Role = (typeof ROLES)[number]
 *   - export function canChangeOrderStatus(role: Role): boolean  (admin et gestionnaire)
 */
export const ROLES = ["admin", "gestionnaire", "lecture"] as const;
export type Role = (typeof ROLES)[number];

//Change le rôle d'une commande : admin et gestionnaire seulement.
// Le front ne doit jamais faire confiance au client, donc la règle est testée côté serveur dans les Server Actions.
export function canChangeOrderStatus(role: Role): boolean {
  return role === "admin" || role === "gestionnaire";
}
