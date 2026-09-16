/*
 * Statut de traitement d'un message client. Deux états seulement, voulus par le
 * client : un message est « non traité » tant que personne ne s'en est occupé,
 * « traité » ensuite. Pas de machine d'états ni de liste blanche de passages
 * (contrairement aux commandes) : les deux sens sont permis, on peut rouvrir un
 * message classé trop vite.
 *
 * Clés anglaises, libellés français ; l'enum Postgres message_status reprend
 * ces clés à l'identique.
 */
export const MESSAGE_STATUSES = ["untreated", "treated"] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  untreated: "Non traité",
  treated: "Traité",
};

/** Intitulé du bouton qui fait basculer le statut (ce qu'il va FAIRE). */
export const MESSAGE_STATUS_ACTION_LABELS: Record<MessageStatus, string> = {
  untreated: "Marquer comme traité",
  treated: "Marquer comme non traité",
};

/**
 * L'autre statut. Le bouton des cartes et de la fiche est une bascule : il
 * envoie le statut VISÉ, que la Server Action recalcule de toute façon à partir
 * du statut relu en base (jamais celui que le formulaire prétend).
 */
export function toggledStatus(status: MessageStatus): MessageStatus {
  return status === "untreated" ? "treated" : "untreated";
}
