/*
 * Rôles du back-office et règles d'autorisation pures.
 *
 * Pourquoi un domaine auth séparé des commandes : les rôles seront consultés par
 * toutes les Server Actions (commandes, catalogue, clients…). Les règles
 * `canXxx(role)` sont pures et testées ici ; les actions les appellent après avoir
 * relu la session côté serveur, jamais en faisant confiance au client.
 *
 * Vocabulaire provisoire (question Q5 au client).
 */
export const ROLES = ["admin", "gestionnaire", "lecture"] as const;
export type Role = (typeof ROLES)[number];

/*
 * Règles d'autorisation pures, une par action métier. Testées côté serveur dans
 * les Server Actions après relecture de la session, jamais en faisant confiance
 * au client. A7 remplacera la session mock, pas ces règles.
 */
const WRITERS: readonly Role[] = ["admin", "gestionnaire"];

/** Changer le statut d'une commande (A2). */
export function canChangeOrderStatus(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Attribuer un livreur (A3). */
export function canAssignCourier(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Modifier prix, disponibilité et stock du catalogue (A4). */
export function canEditProduct(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Ajouter une note interne sur un client (A5). */
export function canAddCustomerNote(role: Role): boolean {
  return WRITERS.includes(role);
}
