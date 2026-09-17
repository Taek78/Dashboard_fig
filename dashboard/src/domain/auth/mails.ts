import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";
import type { MailMessage, MailRecipient } from "@/domain/mail/types";
import { formatDateTimeFr } from "@/lib/format";

/*
 * Textes des mails de la récupération de compte, règles PURES testées :
 * texte brut, en français, sans HTML. Le code et les liens ne figurent que dans
 * le mail à la personne ; les alertes aux administrateurs nomment le compte,
 * l'heure et l'adresse IP, jamais un secret. Chaque mail qui suit une demande
 * dit quoi faire si la personne n'en est pas l'auteur : le lien « Ce n'était
 * pas moi » verrouille le compte (24 heures), et l'administrateur est le
 * recours.
 */
const SIGNATURE =
  "\n\nFIG Back-office\nMessage automatique : il ne sert à rien d'y répondre.";

const greet = (name: string) => `Bonjour ${name},\n\n`;

export type AccountSummary = { name: string; email: string };

export function recoveryCodeMail(input: {
  to: MailRecipient & { name: string };
  code: string;
  lockUrl: string;
}): MailMessage {
  const { validity } = AUTH_TOKEN_RULES.recovery_code;
  return {
    to: input.to,
    subject: "Votre code de récupération FIG",
    text:
      greet(input.to.name) +
      `Voici votre code pour choisir un nouveau mot de passe du back-office FIG :\n\n    ${input.code}\n\n` +
      `Il est valable ${validity} et ne sert qu'une fois. Ne le communiquez à personne : l'équipe FIG ne vous le demandera jamais.\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, votre mot de passe n'a pas changé. Vous pouvez verrouiller votre compte par ce lien (valable ${AUTH_TOKEN_RULES.lock_link.validity}), puis prévenir votre administrateur :\n${input.lockUrl}` +
      SIGNATURE,
  };
}

export function passwordRecoveredMail(input: {
  to: MailRecipient & { name: string };
  at: string;
  ip: string;
  lockUrl: string;
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre mot de passe FIG a été modifié",
    text:
      greet(input.to.name) +
      `Le mot de passe de votre compte du back-office FIG a été modifié par la récupération par e-mail, le ${formatDateTimeFr(input.at)}, depuis l'adresse IP ${input.ip}.\n\n` +
      `Si c'est vous, tout est en ordre.\n\n` +
      `Si ce n'est pas vous, verrouillez votre compte immédiatement par ce lien (valable ${AUTH_TOKEN_RULES.lock_link.validity}) :\n${input.lockUrl}\n\npuis prévenez votre administrateur, qui vous rendra l'accès après vérification.` +
      SIGNATURE,
  };
}

export function adminPasswordRecoveredMail(input: {
  to: MailRecipient & { name: string };
  account: AccountSummary;
  at: string;
  ip: string;
}): MailMessage {
  return {
    to: input.to,
    subject: `Alerte FIG : mot de passe récupéré par e-mail pour ${input.account.name}`,
    text:
      greet(input.to.name) +
      `Le compte « ${input.account.name} » (${input.account.email}) vient de changer de mot de passe par la récupération par e-mail, le ${formatDateTimeFr(input.at)}, depuis l'adresse IP ${input.ip}.\n\n` +
      `Si la personne confirme, il n'y a rien à faire. Sinon, désactivez ce compte depuis la section Comptes et vérifiez avec elle par téléphone avant de le réactiver.` +
      SIGNATURE,
  };
}

export function adminRecoveryLockedMail(input: {
  to: MailRecipient & { name: string };
  account: AccountSummary;
  ip: string;
}): MailMessage {
  const { maxAttempts } = AUTH_TOKEN_RULES.recovery_code;
  return {
    to: input.to,
    subject: `Alerte FIG : codes de récupération erronés pour ${input.account.name}`,
    text:
      greet(input.to.name) +
      `${maxAttempts} codes de récupération erronés ont été saisis pour le compte « ${input.account.name} » (${input.account.email}) depuis l'adresse IP ${input.ip}. Le code a été annulé ; aucun mot de passe n'a changé.\n\n` +
      `C'est peut-être une erreur de saisie, ou une tentative d'intrusion : vérifiez avec la personne. En cas de doute, désactivez le compte depuis la section Comptes.` +
      SIGNATURE,
  };
}

export function adminAccountLockedMail(input: {
  to: MailRecipient & { name: string };
  account: AccountSummary;
  ip: string;
}): MailMessage {
  return {
    to: input.to,
    subject: `Alerte FIG : ${input.account.name} a verrouillé son compte`,
    text:
      greet(input.to.name) +
      `« ${input.account.name} » (${input.account.email}) a verrouillé son compte depuis un mail de récupération qu'il ou elle n'avait pas demandé (adresse IP du clic : ${input.ip}). Le compte est désactivé et ses sessions sont fermées.\n\n` +
      `Vérifiez avec la personne par téléphone, puis réactivez son compte depuis la section Comptes et envoyez-lui un lien pour choisir un nouveau mot de passe.` +
      SIGNATURE,
  };
}

export function invitationMail(input: {
  to: MailRecipient & { name: string };
  url: string;
  byName: string;
  reason: "creation" | "reset";
}): MailMessage {
  const { validity } = AUTH_TOKEN_RULES.invitation;
  const intro =
    input.reason === "creation"
      ? `${input.byName} vous a créé un compte sur le back-office FIG avec cette adresse.`
      : `${input.byName} vous invite à choisir un nouveau mot de passe pour votre compte du back-office FIG.`;
  return {
    to: input.to,
    subject:
      input.reason === "creation"
        ? "Votre accès au back-office FIG"
        : "Choisissez votre nouveau mot de passe FIG",
    text:
      greet(input.to.name) +
      `${intro} Choisissez votre mot de passe par ce lien, valable ${validity} et utilisable une seule fois :\n${input.url}\n\n` +
      `Passé ce délai, demandez un nouveau lien à votre administrateur.\n\n` +
      `Si vous n'attendiez pas ce message, ignorez-le : rien ne se passera sans le lien.` +
      SIGNATURE,
  };
}

export function emailReminderMail(input: {
  to: MailRecipient & { name: string };
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre adresse de connexion FIG",
    text:
      greet(input.to.name) +
      `Vous avez demandé un rappel de votre adresse de connexion au back-office FIG : c'est ${input.to.email}, l'adresse qui reçoit ce message.\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien n'a changé.` +
      SIGNATURE,
  };
}
