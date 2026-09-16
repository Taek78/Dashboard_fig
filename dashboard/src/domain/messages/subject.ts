/*
 * Source de vérité unique des objets de demande, tels que l'application FIG les
 * propose dans « Nous contacter ». La liste vient du client : elle n'est pas
 * ouverte, une demande porte forcément l'un de ces six objets.
 *
 * Même patron que ORDER_STATUSES : le tableau `as const` sert au type
 * MessageSubject, aux libellés, au z.enum() du filtre et au <select> ; une
 * seule liste à modifier, tsc force le reste à suivre (Record<MessageSubject, …>
 * refuse une clé manquante). Clés anglaises (identifiants de code), libellés
 * français (interface). L'enum Postgres message_subject reprend ces clés à
 * l'identique (test/db/schema.test.ts le vérifie).
 */
export const MESSAGE_SUBJECTS = [
  "missing_or_damaged",
  "delivery_issue",
  "order_error",
  "product_question",
  "refund",
  "other",
] as const;

export type MessageSubject = (typeof MESSAGE_SUBJECTS)[number];

export const MESSAGE_SUBJECT_LABELS: Record<MessageSubject, string> = {
  missing_or_damaged: "Produit manquant ou abîmé",
  delivery_issue: "Problème de livraison",
  order_error: "Erreur sur ma commande",
  product_question: "Question sur un produit",
  refund: "Remboursement ou avoir",
  other: "Autre",
};

/**
 * Les RÉCLAMATIONS : objets qui portent un préjudice à réparer (décision du
 * client, 2026-09-16 : produit manquant ou abîmé, problème de livraison,
 * erreur sur la commande, remboursement ou avoir). Elles passent devant dans
 * la lecture d'un coup d'œil (code couleur de la carte) et sont comptées par
 * la métrique « Réclamations ». « Question sur un produit » et « Autre » sont
 * des demandes d'information. Le classement vit ici et non dans l'interface :
 * c'est du métier (ce que le client considère comme une réclamation), pas une
 * couleur.
 */
export const CLAIM_SUBJECTS = [
  "missing_or_damaged",
  "delivery_issue",
  "order_error",
  "refund",
] as const satisfies readonly MessageSubject[];

export function isClaimSubject(subject: MessageSubject): boolean {
  return (CLAIM_SUBJECTS as readonly MessageSubject[]).includes(subject);
}
