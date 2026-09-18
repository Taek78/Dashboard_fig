/*
 * Un mail sortant du dashboard : texte brut seulement (pas de HTML, pas de
 * pièce jointe, pas de suivi d'ouverture). Le texte est composé par des règles
 * pures (domain/auth/mails.ts) ; l'envoi est fait par la façade src/data/mail.ts.
 */
import type { MailFailureReason } from "@/domain/mail/failure";

export type MailRecipient = { email: string; name?: string };

export type MailMessage = {
  to: MailRecipient;
  subject: string;
  text: string;
};

/**
 * Ce qu'un envoi a donné, quand l'appelant a besoin de le SAVOIR : l'écran
 * Comptes attend la réponse du fournisseur avant de dire « invitation
 * envoyée », parce qu'une personne sans lien ne peut pas entrer. Les mails
 * d'information (avis de désactivation, de suppression) restent en `after()`
 * et se contentent du journal.
 */
export type MailOutcome =
  { sent: true } | { sent: false; reason: MailFailureReason };
