/*
 * Confirmation d'une suppression (produit, membre du personnel, article) :
 * depuis le 2026-09-18, une fenêtre « Confirmer / Annuler » remplace le mot
 * SUPPRIMER à taper (demande de l'auteur ; les COMPTES gardent le mot). Le
 * bouton « Confirmer » envoie `confirm=oui`, et le schéma zod de l'action
 * l'exige : un envoi sans ce champ (formulaire forgé ou mal branché) ne
 * supprime rien. Pur, partagé par les composants et les schémas.
 */
export const DELETE_CONFIRMED = "oui";

/** Le message d'une action appelée sans la confirmation. */
export const DELETE_CONFIRM_MESSAGE =
  "Confirmez la suppression dans la fenêtre de confirmation.";
