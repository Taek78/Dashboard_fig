/*
 * Pourquoi un mail n'est pas parti, dit à l'administrateur en français.
 *
 * Un envoi qui échoue n'est pas une panne anonyme : selon la cause, le geste
 * qui répare n'est pas le même (corriger l'adresse, poser la clé d'API,
 * attendre, réessayer). Ces règles sont PURES : le transport (src/data) donne
 * le code HTTP ou l'erreur réseau, `mailFailureOf` en déduit la cause, l'écran
 * affiche le libellé et le geste. Rien ici ne connaît Brevo : un autre
 * fournisseur retomberait sur les mêmes cas.
 *
 * La cause est stockée en base (users.invitation_mail_error) : les clés de
 * l'enum Postgres sont exactement celles de cette liste.
 */
export const MAIL_FAILURE_REASONS = [
  "adresse_refusee",
  "expedition_refusee",
  "configuration",
  "quota_depasse",
  "service_indisponible",
  "injoignable",
  "autre",
] as const;
export type MailFailureReason = (typeof MAIL_FAILURE_REASONS)[number];

/** Ce qui s'est passé, en une phrase, sans jargon ni code HTTP. */
export const MAIL_FAILURE_LABELS: Record<MailFailureReason, string> = {
  adresse_refusee: "L'adresse du destinataire a été refusée.",
  expedition_refusee: "L'adresse d'expédition du back-office a été refusée.",
  configuration: "L'envoi de mails n'est pas configuré sur ce serveur.",
  quota_depasse: "Le quota d'envoi du fournisseur est atteint.",
  service_indisponible: "Le service d'envoi est momentanément en panne.",
  injoignable: "Le service d'envoi n'a pas répondu.",
  autre: "L'envoi a échoué pour une raison inattendue.",
};

/** Le geste qui répare, du plus utile au plus évident. */
export const MAIL_FAILURE_FIXES: Record<MailFailureReason, string> = {
  adresse_refusee:
    "Vérifiez l'orthographe de l'e-mail : s'il est faux, annulez l'invitation et recréez le compte avec la bonne adresse.",
  expedition_refusee:
    "L'adresse d'expédition doit être validée chez le fournisseur : prévenez la personne qui administre le serveur.",
  configuration:
    "La clé d'API et l'adresse d'expédition doivent être posées sur le serveur : prévenez la personne qui l'administre.",
  quota_depasse: "Réessayez plus tard, ou faites relever le quota.",
  service_indisponible: "Réessayez dans quelques minutes.",
  injoignable:
    "Vérifiez la connexion du serveur, puis réessayez dans quelques minutes.",
  autre:
    "Réessayez ; si cela se reproduit, posez un mot de passe vous-même par « Nouveau mot de passe ».",
};

/**
 * Cause déduite d'une réponse HTTP du fournisseur. 400 couvre l'adresse
 * invalide ET l'expéditeur non validé : le corps de la réponse n'est jamais
 * lu (il peut porter des données), donc les deux se disent « adresse refusée »
 * et le geste proposé commence par l'orthographe, le cas le plus fréquent.
 */
export function mailFailureOfStatus(status: number): MailFailureReason {
  if (status === 400 || status === 422) return "adresse_refusee";
  if (status === 401 || status === 403) return "configuration";
  if (status === 429) return "quota_depasse";
  if (status >= 500) return "service_indisponible";
  return "autre";
}

/** Cause déduite d'une erreur réseau : délai dépassé, DNS, connexion refusée. */
export function mailFailureOfNetworkError(name: string): MailFailureReason {
  return name === "TimeoutError" ||
    name === "AbortError" ||
    name === "TypeError"
    ? "injoignable"
    : "autre";
}

/** Libellé complet pour l'écran : ce qui s'est passé, puis quoi faire. */
export function mailFailureText(reason: MailFailureReason): string {
  return `${MAIL_FAILURE_LABELS[reason]} ${MAIL_FAILURE_FIXES[reason]}`;
}
