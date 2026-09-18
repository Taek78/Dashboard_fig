import type { MailFailureReason } from "@/domain/mail/failure";

/*
 * Erreur d'envoi qui PORTE SA CAUSE (domain/mail/failure.ts), pour que la
 * façade la rende à l'appelant sans relire la réponse du fournisseur. Le
 * message reste technique (journal, console) ; l'écran affiche le libellé
 * français de la cause, jamais ce message.
 */
export class MailSendError extends Error {
  readonly reason: MailFailureReason;

  constructor(reason: MailFailureReason, message: string) {
    super(message);
    this.name = "MailSendError";
    this.reason = reason;
  }
}

/** Cause d'une erreur quelconque : la sienne si elle en porte une, sinon « autre ». */
export function reasonOf(error: unknown): MailFailureReason {
  return error instanceof MailSendError ? error.reason : "autre";
}
