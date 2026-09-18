/*
 * Levée par createMessage quand un fichier demandé n'est pas utilisable :
 * inconnu, téléversé par une autre personne, ou déjà rattaché à un message.
 * Les trois cas ont la même réponse (on ne dit pas à quelqu'un qu'un fichier
 * existe chez un autre) ; la route de l'API la traduit en 422.
 */
export class AttachmentUnavailableError extends Error {
  readonly uploadIds: readonly string[];

  constructor(uploadIds: readonly string[]) {
    super(`Fichiers indisponibles : ${uploadIds.join(", ")}`);
    this.name = "AttachmentUnavailableError";
    this.uploadIds = uploadIds;
  }
}
