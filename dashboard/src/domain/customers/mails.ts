import { LOGIN_CODE_VALIDITY } from "@/domain/api/session";
import type { MailMessage } from "@/domain/mail/types";

/*
 * Mails envoyés aux CLIENTS de l'application par l'API, règles pures (texte
 * brut, français). Un seul pour l'instant : le code de connexion. Il ne nomme
 * pas la personne (l'adresse peut être inconnue : c'est aussi le chemin de
 * l'inscription) et ne contient ni lien ni identifiant, seulement le code.
 */
const SIGNATURE =
  "\n\nÀ bientôt,\nL'équipe FIG\n\nMessage automatique : il ne sert à rien d'y répondre.";

export function customerLoginCodeMail(input: {
  to: { email: string };
  code: string;
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre code de connexion FIG",
    text:
      `Bonjour,\n\n` +
      `Voici votre code pour vous connecter à l'application FIG :\n\n    ${input.code}\n\n` +
      `Il est valable ${LOGIN_CODE_VALIDITY} et ne sert qu'une fois. Ne le communiquez à personne : l'équipe FIG ne vous le demandera jamais.\n\n` +
      `Si vous n'avez rien demandé, ignorez simplement ce message : sans le code, personne ne peut accéder à votre compte.` +
      SIGNATURE,
  };
}
