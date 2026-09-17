import type { MailMessage } from "@/domain/mail/types";

/*
 * CONTRAT d'envoi de mail : une seule fonction, implémentée par deux transports
 * dans src/data (Brevo par son API HTTP en production, un fichier par mail en
 * développement et dans la suite navigateur). Le reste de l'application ne
 * connaît que ce contrat : changer de fournisseur ne touche qu'un module.
 */
export type MailSender = {
  sendMail(message: MailMessage): Promise<void>;
};
