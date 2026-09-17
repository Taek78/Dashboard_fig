/*
 * Un mail sortant du dashboard : texte brut seulement (pas de HTML, pas de
 * pièce jointe, pas de suivi d'ouverture). Le texte est composé par des règles
 * pures (domain/auth/mails.ts) ; l'envoi est fait par la façade src/data/mail.ts.
 */
export type MailRecipient = { email: string; name?: string };

export type MailMessage = {
  to: MailRecipient;
  subject: string;
  text: string;
};
