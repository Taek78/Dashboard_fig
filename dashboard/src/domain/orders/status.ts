/*
 * Source de vérité unique des statuts de commande.
 *
 * Pourquoi un fichier à part : le tableau `as const` sert au type OrderStatus, aux
 * libellés, au z.enum() des Server Actions et aux <select>. Une seule liste à
 * modifier, tsc force le reste à suivre (Record<OrderStatus, …> refuse une clé
 * manquante).
 *
 * Clés anglaises (identifiants de code), libellés français (interface). L'enum
 * Postgres order_status reprend ces clés à l'identique.
 *
 * Trois états de parcours (décision du client, 2026-09-15) : une commande reçue
 * est en préparation, puis expédiée, puis livrée ; l'annulation est une issue à
 * part, avec un motif. Plus de « confirmée » ni d'« en attente » (migrations
 * 0003 et 0005).
 *
 * Changement de statut LIBRE (décision du client, 2026-09-17) : plus de règle
 * d'étape. L'équipe passe une commande à n'importe quel autre statut (livrée
 * directement, retour en préparation, annulation d'une commande expédiée ou
 * livrée, reprise d'une commande annulée). La règle reste ici, dans le
 * domaine, consultée par la Server Action changeOrderStatus et par la liste
 * du statut : la resserrer un jour ne touchera aucun écran. Ce qui demeure :
 * rester sur place n'est pas un changement (l'action est idempotente), et
 * l'annulation exige toujours son motif (changeStatusSchema).
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

/** Statuts terminaux : plus rien à faire sur la commande, plus aucune affectation tant qu'elle n'est pas remise en cours. */
export const FINISHED_STATUSES = [
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export function isFinished(status: OrderStatus): boolean {
  return (FINISHED_STATUSES as readonly OrderStatus[]).includes(status);
}

/** Vrai si le passage from → to est un changement : tout statut différent du
 *  courant est permis. Renvoie, ne lève pas : c'est l'action qui choisit le message. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from !== to;
}

/** Statuts atteignables depuis `from` : les trois autres, dans l'ordre de la liste. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((status) => status !== from);
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
