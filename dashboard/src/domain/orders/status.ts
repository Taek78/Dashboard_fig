/*
 * Source de vérité unique des statuts de commande.
 *
 * Pourquoi un fichier à part : le tableau `as const` sert au type OrderStatus, aux
 * libellés, au futur z.enum() des Server Actions et aux <select>. Une seule liste à
 * modifier, tsc force le reste à suivre (Record<OrderStatus, …> refuse une clé
 * manquante). La machine d'états vit ici aussi : ORDER_TRANSITIONS est une liste
 * blanche (tout passage non listé est refusé, y compris rester sur place ou revenir
 * en arrière), consultée par la Server Action changeOrderStatus (refus) et par la
 * carte Statut du détail (options du <select>).
 *
 * Clés anglaises (identifiants de code), libellés français (interface). Vocabulaire
 * à confirmer avec le client (question 9) ; l'enum Postgres order_status reprend
 * ces clés à l'identique.
 *
 * Pas de statut « confirmée » (décision du client, 2026-09-15) : une commande
 * reçue est considérée comme déjà prise en charge, « en attente » passe
 * directement à « en préparation ».
 */
export const ORDER_STATUSES = [
  "pending",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
] as const; //Avec as const, chaque élément garde son type littéral ("pending", "preparing"…) et le tableau devient readonly

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  preparing: "En préparation",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Vrai si le passage from → to est dans la liste blanche. Renvoie, ne lève pas :
 *  c'est l'action qui choisit le message. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Statuts atteignables depuis `from`, en copie : le tableau de la matrice est
 *  partagé par tout le serveur, personne ne doit pouvoir le modifier. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...ORDER_TRANSITIONS[from]];
}

/**
 * Chemin nominal de « en attente » jusqu'à `to`, bornes incluses : sert aux
 * fixtures d'historique. Une annulation part toujours de « en attente ».
 * ["pending", "preparing", "delivering"] pour "delivering".
 */
export function statusPath(to: OrderStatus): OrderStatus[] {
  if (to === "cancelled") return ["pending", "cancelled"];
  return ORDER_STATUSES.slice(0, ORDER_STATUSES.indexOf(to) + 1);
}
