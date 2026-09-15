/*
 * Source de vérité unique des statuts de commande.
 *
 * Pourquoi un fichier à part : le tableau `as const` sert au type OrderStatus, aux
 * libellés, au z.enum() des Server Actions et aux <select>. Une seule liste à
 * modifier, tsc force le reste à suivre (Record<OrderStatus, …> refuse une clé
 * manquante). La machine d'états vit ici aussi : ORDER_TRANSITIONS est une liste
 * blanche (tout passage non listé est refusé, y compris rester sur place ou revenir
 * en arrière), consultée par la Server Action changeOrderStatus (refus) et par la
 * carte Statut du détail (options du <select>).
 *
 * Clés anglaises (identifiants de code), libellés français (interface). L'enum
 * Postgres order_status reprend ces clés à l'identique.
 *
 * Trois états de parcours (décision du client, 2026-09-15) : une commande reçue
 * est en préparation, puis expédiée, puis livrée. Plus de « confirmée » ni
 * d'« en attente » (migrations 0003 et 0005). L'annulation reste une issue à
 * part, possible tant que la commande est en préparation, avec un motif.
 */
export const ORDER_STATUSES = [
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
] as const; //Avec as const, chaque élément garde son type littéral ("preparing", "delivering"…) et le tableau devient readonly

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  preparing: "En préparation",
  delivering: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  preparing: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Statuts terminaux : plus rien à faire sur la commande, plus aucune affectation. */
export const FINISHED_STATUSES = [
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export function isFinished(status: OrderStatus): boolean {
  return (FINISHED_STATUSES as readonly OrderStatus[]).includes(status);
}

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
 * Chemin nominal de « en préparation » jusqu'à `to`, bornes incluses : sert aux
 * fixtures d'historique. Une annulation part toujours de « en préparation ».
 * ["preparing", "delivering"] pour "delivering".
 */
export function statusPath(to: OrderStatus): OrderStatus[] {
  if (to === "cancelled") return ["preparing", "cancelled"];
  return ORDER_STATUSES.slice(0, ORDER_STATUSES.indexOf(to) + 1);
}
