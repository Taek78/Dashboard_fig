/*
 * Source de vérité unique des statuts de commande.
 *
 * Pourquoi un fichier à part : le tableau `as const` sert au type OrderStatus, aux
 * libellés, au futur z.enum() des Server Actions et aux <select>. Une seule liste à
 * modifier, tsc force le reste à suivre (Record<OrderStatus, …> refuse une clé
 * manquante). La machine d'états canTransition() (A2) vivra ici, à côté des statuts.
 *
 * Clés anglaises (identifiants de code), libellés français (interface). Vocabulaire
 * provisoire du front : à aligner sur celui du client (question Q9), puis traduit
 * dans le mapper toOrder() au moment du branchement (piste B3).
 */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};
