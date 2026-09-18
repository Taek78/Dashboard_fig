import { ROLE_LABELS, type Role } from "@/domain/auth/roles";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";
import type { MailMessage, MailRecipient } from "@/domain/mail/types";
import { formatDateTimeFr } from "@/lib/format";

/*
 * Textes des mails de la récupération et de la gestion des comptes
 * (invitation, activation, expiration, désactivation, suppression), règles
 * PURES testées : texte brut, en français, sans HTML. Le code et les liens ne
 * figurent que dans le mail à la personne ; les alertes aux administrateurs
 * nomment le compte, l'heure et l'adresse IP, jamais un secret. Chaque mail
 * qui suit une demande dit quoi faire si la personne n'en est pas l'auteur :
 * le lien « Ce n'était pas moi » verrouille le compte (24 heures), et
 * l'administrateur est le recours. Les avis à une personne (activation,
 * expiration, désactivation, suppression) donnent l'ADRESSE de
 * l'administrateur à contacter, jamais son nom (adminContact) : la personne
 * garde un recours concret, sans qu'un membre de l'équipe soit nommé dans un
 * message qui sort du back-office (demande du 2026-09-18, qui restreint la
 * décision du 2026-09-17). Les avis ENTRE administrateurs gardent le nom de
 * celui qui a agi : c'est la traçabilité interne d'un geste sur un compte.
 */
const SIGNATURE =
  "\n\nBien cordialement,\nL'équipe FIG\n\nFIG Back-office\nMessage automatique : il ne sert à rien d'y répondre.";

const greet = (name: string) => `Bonjour ${name},\n\n`;

export type AccountSummary = { name: string; email: string };

/**
 * « votre administrateur (admin@fig.example) », ou la liste des adresses
 * quand ils sont plusieurs ; sans adresse connue, le mot seul. Le NOM n'y
 * figure pas : la personne doit pouvoir écrire à quelqu'un, pas savoir qui
 * est derrière la décision.
 */
export function adminContact(admins: readonly AccountSummary[]): string {
  const emails = admins.map((a) => a.email).filter((email) => email !== "");
  if (emails.length === 0) return "votre administrateur";
  if (emails.length === 1) return `votre administrateur (${emails[0]})`;
  return `l'un de vos administrateurs : ${emails.join(", ")}`;
}

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
  reason: "creation" | "reset";
}): MailMessage {
  const { validity } = AUTH_TOKEN_RULES.invitation;
  const intro =
    input.reason === "creation"
      ? `L'administrateur vous a créé un compte sur le back-office FIG avec cette adresse.`
      : `L'administrateur vous invite à choisir un nouveau mot de passe pour votre compte du back-office FIG.`;
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

/**
 * Compte activé (demande du 2026-09-17) : à la personne, dès que son mot de
 * passe existe. `byAdmin` faux = elle l'a choisi par le lien d'invitation ;
 * vrai = un administrateur le lui a attribué (dépannage) et elle devra le
 * changer. Tout ce qu'il faut pour se connecter, jamais le mot de passe, et
 * jamais le nom de l'administrateur (demande du 2026-09-18).
 */
export function accountActivatedMail(input: {
  to: MailRecipient & { name: string };
  at: string;
  role: Role;
  loginUrl: string;
  admins: readonly AccountSummary[];
  /** Vrai quand un administrateur a posé le mot de passe (dépannage), faux quand la personne l'a choisi. */
  byAdmin: boolean;
}): MailMessage {
  const password = input.byAdmin
    ? "celui que l'administrateur vous a attribué et vous communiquera par un canal sûr. Changez-le dès votre première connexion, depuis votre profil."
    : "celui que vous venez de choisir. Nous ne le connaissons pas et ne vous le demanderons jamais.";
  return {
    to: input.to,
    subject: "Votre compte du back-office FIG est activé",
    text:
      greet(input.to.name) +
      `Votre compte d'accès au back-office FIG est activé depuis le ${formatDateTimeFr(input.at)} : bienvenue dans l'équipe !\n\n` +
      `Pour vous connecter :\n` +
      `- adresse de connexion : ${input.loginUrl}\n` +
      `- identifiant : ${input.to.email}\n` +
      `- mot de passe : ${password}\n` +
      `- rôle attribué : ${ROLE_LABELS[input.role]}.\n\n` +
      `Si vous oubliez votre mot de passe, « Mot de passe oublié » sur la page de connexion vous enverra un code par e-mail ; « Adresse e-mail oubliée » vous rappellera votre identifiant à partir de votre nom.\n\n` +
      `Si vous n'êtes pas à l'origine de cette activation, signalez-le sans attendre : votre compte sera désactivé le temps de vérifier.\n\n` +
      `Pour cela comme pour toute question, contactez ${adminContact(input.admins)}.` +
      SIGNATURE,
  };
}

/** Compte activé : à chaque administrateur actif, pour information (rien à faire). */
export function adminAccountActivatedMail(input: {
  to: MailRecipient & { name: string };
  account: AccountSummary & { role: Role };
  at: string;
  comptesUrl: string;
  by: string | null;
}): MailMessage {
  const how =
    input.by === null
      ? `vient d'activer son compte du back-office FIG, le ${formatDateTimeFr(input.at)}, en choisissant son mot de passe par le lien d'invitation.`
      : `a vu son compte du back-office FIG activé le ${formatDateTimeFr(input.at)} par ${input.by}, qui lui a attribué un mot de passe.`;
  return {
    to: input.to,
    subject: `Compte activé : ${input.account.name}`,
    text:
      greet(input.to.name) +
      `${input.account.name} (${input.account.email}) ${how} Rôle attribué : ${ROLE_LABELS[input.account.role]}. Cette personne peut se connecter dès maintenant ; elle en a été informée par e-mail.\n\n` +
      `Il n'y a rien à faire. Vous pouvez à tout moment modifier son rôle ou désactiver son compte depuis la section Comptes :\n${input.comptesUrl}` +
      SIGNATURE,
  };
}

/**
 * Invitation expirée sans avoir été utilisée : à la personne. Rien n'est
 * activé ; un nouveau lien se demande à l'administrateur, seul habilité à
 * créer un compte et à envoyer l'invitation.
 */
export function invitationExpiredMail(input: {
  to: MailRecipient & { name: string };
  expiresAt: string;
  admins: readonly AccountSummary[];
}): MailMessage {
  const { validity } = AUTH_TOKEN_RULES.invitation;
  return {
    to: input.to,
    subject: "Votre invitation au back-office FIG a expiré",
    text:
      greet(input.to.name) +
      `Le lien qui vous invitait à choisir votre mot de passe pour le back-office FIG a expiré le ${formatDateTimeFr(input.expiresAt)}, sans avoir été utilisé. Il n'était valable que ${validity}.\n\n` +
      `Aucun compte n'est donc actif à cette adresse (${input.to.email}) : vous ne pouvez pas encore vous connecter, et rien n'a été enregistré de votre part.\n\n` +
      `Si vous souhaitez toujours accéder au back-office, il suffit de demander un nouveau lien à votre administrateur : vous recevrez alors un nouveau message, avec un lien valable ${validity}. Seul un administrateur est habilité à créer un compte et à envoyer cette invitation.\n\n` +
      `Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message : rien ne se passera sans le lien.\n\n` +
      `Pour obtenir ce nouveau lien, ou pour toute question, contactez ${adminContact(input.admins)}.` +
      SIGNATURE,
  };
}

/** Invitation expirée : à chaque administrateur actif, avec les deux gestes possibles. */
export function adminInvitationExpiredMail(input: {
  to: MailRecipient & { name: string };
  account: AccountSummary & { role: Role };
  expiresAt: string;
  comptesUrl: string;
}): MailMessage {
  const { validity } = AUTH_TOKEN_RULES.invitation;
  return {
    to: input.to,
    subject: `Invitation expirée : ${input.account.name} n'a pas activé son compte`,
    text:
      greet(input.to.name) +
      `L'invitation envoyée à ${input.account.name} (${input.account.email}), avec le rôle ${ROLE_LABELS[input.account.role]}, a expiré le ${formatDateTimeFr(input.expiresAt)} sans avoir été utilisée. Le compte n'est pas activé et cette personne ne peut pas se connecter au back-office FIG. Elle vient d'en être informée par e-mail, avec les coordonnées des administrateurs à contacter.\n\n` +
      `Le compte reste en attente dans la section Comptes, où deux choix s'offrent à vous :\n` +
      `- « Renvoyer l'invitation » : un nouveau lien, valable ${validity}, lui est envoyé ;\n` +
      `- « Annuler l'invitation » : le compte, jamais activé, est supprimé.\n\n` +
      `${input.comptesUrl}\n\n` +
      `Rien ne changera tant que vous n'aurez pas choisi.` +
      SIGNATURE,
  };
}

/**
 * Compte désactivé par un administrateur (demande du 2026-09-17) : ton
 * professionnel, la date, ce que cela change, et l'administrateur à contacter
 * pour plus d'informations. Le compte reste et peut être réactivé.
 */
export function accountDeactivatedMail(input: {
  to: MailRecipient & { name: string };
  at: string;
  admin: AccountSummary;
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre accès au back-office FIG a été désactivé",
    text:
      greet(input.to.name) +
      `Votre compte d'accès au back-office FIG (${input.to.email}) a été désactivé le ${formatDateTimeFr(input.at)}. Vous ne pouvez plus vous y connecter et vos sessions ouvertes ont été fermées.\n\n` +
      `Votre compte n'est pas supprimé : un administrateur peut le réactiver.\n\n` +
      `Pour plus d'informations, contactez ${adminContact([input.admin])}.` +
      SIGNATURE,
  };
}

/**
 * Compte supprimé : envoyé à l'ancienne adresse du compte. Un nouveau compte
 * peut y être créé, sur invitation ; seul un administrateur est habilité à
 * créer un compte et à envoyer cette invitation.
 */
/**
 * Invitation annulée avant son acceptation : le compte n'a jamais existé
 * autrement que comme une invitation, et le lien reçu ne fonctionne plus. Le
 * ton reste neutre et court : la personne n'a rien fait, elle n'a rien à
 * faire, et l'administrateur est nommé si elle attendait cet accès.
 */
export function invitationCancelledMail(input: {
  to: MailRecipient & { name: string };
  at: string;
  admin: AccountSummary;
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre invitation au back-office FIG a été annulée",
    text:
      greet(input.to.name) +
      `L'invitation à créer votre accès au back-office FIG (${input.to.email}) a été annulée le ${formatDateTimeFr(input.at)}.\n\n` +
      `Le lien que vous avez reçu ne fonctionne plus et aucun compte n'a été créé à votre nom. Vous n'avez rien à faire.\n\n` +
      `Si vous attendiez cet accès, ou si cette annulation vous surprend, contactez ${adminContact([input.admin])} : une nouvelle invitation peut vous être envoyée.` +
      SIGNATURE,
  };
}

export function accountDeletedMail(input: {
  to: MailRecipient & { name: string };
  at: string;
  admin: AccountSummary;
}): MailMessage {
  return {
    to: input.to,
    subject: "Votre compte du back-office FIG a été supprimé",
    text:
      greet(input.to.name) +
      `Votre compte d'accès au back-office FIG (${input.to.email}) a été supprimé le ${formatDateTimeFr(input.at)}. Vous ne pouvez plus vous y connecter et vos sessions ouvertes ont été fermées.\n\n` +
      `Si vous pensez qu'il s'agit d'une erreur, ou si vous avez de nouveau besoin d'un accès, adressez votre demande à votre administrateur depuis cette adresse : un nouveau compte peut y être créé, sur invitation. Seul un administrateur est habilité à créer un compte et à envoyer cette invitation.\n\n` +
      `Pour plus d'informations, contactez ${adminContact([input.admin])}.` +
      SIGNATURE,
  };
}
