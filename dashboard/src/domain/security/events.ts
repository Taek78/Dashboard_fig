import type { SecurityEvent } from "@/lib/security-log";

/*
 * Le journal de sécurité, rendu lisible.
 *
 * `security_events` grossit depuis la première version : connexions refusées,
 * changements de rôle, exports RGPD, appels de l'API. Jusqu'ici personne ne
 * pouvait le lire sans ouvrir la base. Ce module donne à chaque type son
 * libellé français, sa FAMILLE (le filtre de l'écran) et son TON (ce qui se
 * repère d'un coup d'œil : un refus n'a pas la couleur d'une connexion
 * réussie), puis compose la phrase affichée à partir des détails enregistrés.
 *
 * Règles PURES. Deux garde-fous tenus ici :
 * - `SECURITY_EVENT_META` est un Record sur le type union : ajouter un
 *   événement sans lui donner de libellé ne compile pas ;
 * - les détails relus de la base sont du JSON quelconque (une ligne écrite par
 *   une version plus ancienne, ou une main sur la table). Ils sont lus avec
 *   méfiance, jamais désérialisés en confiance : un champ manquant donne un
 *   tiret, il ne casse pas l'écran.
 */
export type SecurityEventType = SecurityEvent["type"];

export const SECURITY_FAMILIES = [
  "connexion",
  "comptes",
  "commandes",
  "catalogue",
  "personnel",
  "clients",
  "messages",
  "application",
  "mails",
] as const;
export type SecurityFamily = (typeof SECURITY_FAMILIES)[number];

export const SECURITY_FAMILY_LABELS: Record<SecurityFamily, string> = {
  connexion: "Connexion et mots de passe",
  comptes: "Comptes du back-office",
  commandes: "Commandes",
  catalogue: "Catalogue",
  personnel: "Personnel",
  clients: "Clients et RGPD",
  messages: "Messages",
  application: "API de l'application",
  mails: "Envois de mails",
};

/**
 * Ton d'un événement, qui donne sa couleur à la bande de gauche :
 * - `alerte` (rouge) : un refus, un verrouillage, une limite atteinte. Ce
 *   qu'on vient chercher après un incident ;
 * - `sensible` (ambre) : une action volontaire et irréversible, ou qui retire
 *   un accès (suppression, anonymisation, export, désactivation) ;
 * - `creation` (vert) : un accès NOUVEAU est né. Demande du 2026-09-18 : un
 *   compte créé se repère d'un coup d'œil dans la page, parce que c'est
 *   l'événement qu'un administrateur relit en premier quand il vérifie qui a
 *   obtenu quoi ;
 * - `normal` : la vie ordinaire du back-office.
 */
export const SECURITY_TONES = [
  "alerte",
  "sensible",
  "creation",
  "normal",
] as const;
export type SecurityTone = (typeof SECURITY_TONES)[number];
export const SECURITY_TONE_LABELS: Record<SecurityTone, string> = {
  alerte: "Alerte",
  sensible: "Action sensible",
  creation: "Création d'un accès",
  normal: "Courant",
};

/**
 * `family: null` = type inconnu, écrit par une version plus récente ou à la
 * main dans la table. Il reste AFFICHABLE (libellé brut, ton courant) mais
 * n'appartient à aucune famille : cocher une famille ne doit jamais le faire
 * remonter par défaut, et la base ne le ferait pas non plus (elle filtre sur
 * la liste des types connus). Les deux côtés disent donc la même chose.
 */
type Meta = {
  family: SecurityFamily | null;
  label: string;
  tone: SecurityTone;
};

export const SECURITY_EVENT_META: Record<
  SecurityEventType,
  Meta & { family: SecurityFamily }
> = {
  login_success: {
    family: "connexion",
    label: "Connexion réussie",
    tone: "normal",
  },
  login_failure: {
    family: "connexion",
    label: "Connexion refusée",
    tone: "alerte",
  },
  login_locked: {
    family: "connexion",
    label: "Connexions bloquées",
    tone: "alerte",
  },
  forbidden: { family: "comptes", label: "Accès refusé", tone: "alerte" },
  password_changed: {
    family: "connexion",
    label: "Mot de passe changé",
    tone: "sensible",
  },
  recovery_requested: {
    family: "connexion",
    label: "Code de récupération demandé",
    tone: "normal",
  },
  recovery_throttled: {
    family: "connexion",
    label: "Récupération limitée",
    tone: "alerte",
  },
  recovery_failed: {
    family: "connexion",
    label: "Code de récupération erroné",
    tone: "alerte",
  },
  recovery_locked: {
    family: "connexion",
    label: "Récupération verrouillée",
    tone: "alerte",
  },
  password_recovered: {
    family: "connexion",
    label: "Mot de passe récupéré",
    tone: "sensible",
  },
  account_locked_by_owner: {
    family: "connexion",
    label: "Compte verrouillé par la personne",
    tone: "alerte",
  },
  email_reminder_requested: {
    family: "connexion",
    label: "Rappel d'adresse demandé",
    tone: "normal",
  },
  account_created: {
    family: "comptes",
    label: "Compte créé",
    tone: "creation",
  },
  account_updated: {
    family: "comptes",
    label: "Compte modifié",
    tone: "sensible",
  },
  account_deactivated: {
    family: "comptes",
    label: "Compte désactivé",
    tone: "sensible",
  },
  account_reactivated: {
    family: "comptes",
    label: "Compte réactivé",
    tone: "sensible",
  },
  account_deleted: {
    family: "comptes",
    label: "Compte supprimé",
    tone: "sensible",
  },
  password_reset: {
    family: "comptes",
    label: "Mot de passe attribué",
    tone: "sensible",
  },
  invitation_sent: {
    family: "comptes",
    label: "Invitation envoyée",
    tone: "normal",
  },
  invitation_mail_failed: {
    family: "comptes",
    label: "Invitation non partie",
    tone: "alerte",
  },
  invitation_accepted: {
    family: "comptes",
    label: "Invitation acceptée",
    tone: "normal",
  },
  invitation_cancelled: {
    family: "comptes",
    label: "Invitation annulée",
    tone: "sensible",
  },
  invitation_expired: {
    family: "comptes",
    label: "Invitation expirée",
    tone: "normal",
  },
  order_status_changed: {
    family: "commandes",
    label: "Statut de commande changé",
    tone: "normal",
  },
  notification_requeued: {
    family: "commandes",
    label: "Notification client renvoyée",
    tone: "normal",
  },
  order_staff_assigned: {
    family: "commandes",
    label: "Équipe affectée",
    tone: "normal",
  },
  product_deleted: {
    family: "catalogue",
    label: "Produit supprimé",
    tone: "sensible",
  },
  product_duplicated: {
    family: "catalogue",
    label: "Produit dupliqué",
    tone: "normal",
  },
  catalog_settings_changed: {
    family: "catalogue",
    label: "Réglage du catalogue changé",
    tone: "sensible",
  },
  article_deleted: {
    family: "catalogue",
    label: "Article supprimé",
    tone: "sensible",
  },
  staff_created: {
    family: "personnel",
    label: "Personne ajoutée",
    tone: "normal",
  },
  staff_updated: {
    family: "personnel",
    label: "Personne modifiée",
    tone: "normal",
  },
  staff_deleted: {
    family: "personnel",
    label: "Personne supprimée",
    tone: "sensible",
  },
  customer_exported: {
    family: "clients",
    label: "Données d'un client exportées",
    tone: "sensible",
  },
  customer_anonymized: {
    family: "clients",
    label: "Client anonymisé",
    tone: "sensible",
  },
  message_status_changed: {
    family: "messages",
    label: "Message traité ou rouvert",
    tone: "normal",
  },
  message_pinned: {
    family: "messages",
    label: "Message épinglé",
    tone: "normal",
  },
  message_flagged: {
    family: "messages",
    label: "Message signalé important",
    tone: "normal",
  },
  api_code_requested: {
    family: "application",
    label: "Code de connexion demandé",
    tone: "normal",
  },
  api_code_throttled: {
    family: "application",
    label: "Demandes de code limitées",
    tone: "alerte",
  },
  api_code_failed: {
    family: "application",
    label: "Code de connexion erroné",
    tone: "alerte",
  },
  api_session_opened: {
    family: "application",
    label: "Session client ouverte",
    tone: "normal",
  },
  api_session_closed: {
    family: "application",
    label: "Session client fermée",
    tone: "normal",
  },
  api_profile_updated: {
    family: "application",
    label: "Profil client modifié",
    tone: "normal",
  },
  api_community_changed: {
    family: "application",
    label: "Communauté du client changée",
    tone: "normal",
  },
  api_order_created: {
    family: "application",
    label: "Commande créée par l'application",
    tone: "normal",
  },
  api_order_cancelled: {
    family: "application",
    label: "Commande annulée par le client",
    tone: "normal",
  },
  api_message_created: {
    family: "application",
    label: "Message déposé par un client",
    tone: "normal",
  },
  api_file_uploaded: {
    family: "application",
    label: "Fichier téléversé par un client",
    tone: "normal",
  },
  api_file_rejected: {
    family: "application",
    label: "Fichier refusé",
    tone: "alerte",
  },
  api_notification_sent: {
    family: "application",
    label: "Notification marquée envoyée",
    tone: "normal",
  },
  api_notification_failed: {
    family: "application",
    label: "Échec d'envoi d'une notification",
    tone: "sensible",
  },
  api_service_forbidden: {
    family: "application",
    label: "Clé de service refusée",
    tone: "alerte",
  },
  api_rate_limited: {
    family: "application",
    label: "Appel limité",
    tone: "alerte",
  },
  mail_failed: { family: "mails", label: "Mail non parti", tone: "alerte" },
};

/** Les types d'une famille, dans l'ordre de leur déclaration. */
export function typesOfFamily(family: SecurityFamily): SecurityEventType[] {
  return (Object.keys(SECURITY_EVENT_META) as SecurityEventType[]).filter(
    (type) => SECURITY_EVENT_META[type].family === family,
  );
}

/** Un type inconnu (ligne écrite par une version plus récente) reste lisible. */
export function metaOf(type: string): Meta {
  return (
    SECURITY_EVENT_META[type as SecurityEventType] ?? {
      family: null,
      label: type,
      tone: "normal",
    }
  );
}

/** La famille d'un type, ou null s'il est inconnu : ce que le filtre utilise. */
export function familyOf(type: string): SecurityFamily | null {
  return metaOf(type).family;
}

/* ---------- Lecture méfiante des détails ---------- */

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const yes = (value: unknown): boolean => value === true;

/** « — » quand le détail manque : l'écran reste lisible, la ligne reste vraie. */
const or = (value: string | null) => value ?? "—";

/**
 * La phrase affichée, composée des détails de l'événement. Elle ne répète
 * jamais le libellé (déjà sur la pastille) : elle dit QUI, SUR QUOI et DEPUIS
 * OÙ. Les identifiants techniques sont laissés tels quels : ce sont eux qu'on
 * recolle à une commande ou à un compte pendant une enquête.
 */
export function describeSecurityEvent(
  type: string,
  details: Record<string, unknown>,
): string {
  const d = details;
  switch (type) {
    case "login_success":
    case "login_failure":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))}`;
    case "login_locked":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))} : trop de tentatives`;
    case "forbidden":
      return `compte ${or(text(d.userId))} a tenté « ${or(text(d.action))} »`;
    case "password_changed":
      return `compte ${or(text(d.userId))}`;
    case "recovery_requested":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))}${
        text(d.userId) === null ? " (aucun compte à cette adresse)" : ""
      }`;
    case "recovery_throttled":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))} : quota atteint`;
    case "recovery_failed":
      return `compte ${or(text(d.userId))}, depuis ${or(text(d.ip))} : ${
        typeof d.attempts === "number" ? d.attempts : "?"
      } essai(s)`;
    case "recovery_locked":
    case "password_recovered":
    case "account_locked_by_owner":
    case "invitation_accepted":
      return `compte ${or(text(d.userId))}, depuis ${or(text(d.ip))}`;
    case "email_reminder_requested":
      return `depuis ${or(text(d.ip))}${
        text(d.userId) === null ? " (aucun compte)" : ""
      }`;
    case "account_created":
    case "account_updated":
      return `compte ${or(text(d.targetId))} (${or(text(d.role))}), par ${or(text(d.userId))}`;
    case "account_deactivated":
    case "account_reactivated":
    case "account_deleted":
    case "password_reset":
    case "invitation_sent":
    case "invitation_cancelled":
      return `compte ${or(text(d.targetId))}, par ${or(text(d.userId))}`;
    case "invitation_mail_failed":
      return `compte ${or(text(d.targetId))}, par ${or(text(d.userId))} : ${or(text(d.reason))}`;
    case "invitation_expired":
      return `compte ${or(text(d.targetId))}`;
    case "order_status_changed":
      return `commande ${or(text(d.orderId))} : ${or(text(d.from))} → ${or(text(d.to))}, par ${or(text(d.userId))}`;
    case "notification_requeued":
      return `notification ${or(text(d.notificationId))}, commande ${or(text(d.orderId))}, par ${or(text(d.userId))}`;
    case "order_staff_assigned":
      return `commande ${or(text(d.orderId))} : ${or(text(d.role))} ${
        text(d.staffId) === null ? "retiré" : `→ ${text(d.staffId)}`
      }, par ${or(text(d.userId))}`;
    case "product_deleted":
      return `produit ${or(text(d.productId))}, par ${or(text(d.userId))}`;
    case "product_duplicated":
      return `produit ${or(text(d.productId))} → ${or(text(d.copyId))}, par ${or(text(d.userId))}`;
    case "catalog_settings_changed":
      return `vente à stock 0 ${yes(d.sellWhenOutOfStock) ? "activée" : "désactivée"}, par ${or(text(d.userId))}`;
    case "article_deleted":
      return `article ${or(text(d.articleId))}, par ${or(text(d.userId))}`;
    case "staff_created":
    case "staff_updated":
      return `personne ${or(text(d.staffId))} (${or(text(d.kind))}), par ${or(text(d.userId))}`;
    case "staff_deleted":
      return `personne ${or(text(d.staffId))}, par ${or(text(d.userId))}`;
    case "customer_exported":
    case "customer_anonymized":
      return `client ${or(text(d.customerId))}, par ${or(text(d.userId))}`;
    case "message_status_changed":
      return `message ${or(text(d.messageId))} : ${or(text(d.from))} → ${or(text(d.to))}, par ${or(text(d.userId))}`;
    case "message_pinned":
      return `message ${or(text(d.messageId))} ${yes(d.pinned) ? "épinglé" : "désépinglé"}, par ${or(text(d.userId))}`;
    case "message_flagged":
      return `message ${or(text(d.messageId))} ${yes(d.important) ? "signalé important" : "rendu ordinaire"}, par ${or(text(d.userId))}`;
    case "api_code_requested":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))}${
        text(d.customerId) === null ? " (nouvelle adresse)" : ""
      }`;
    case "api_code_throttled":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))} : quota atteint`;
    case "api_code_failed":
      return `${or(text(d.email))}, depuis ${or(text(d.ip))} : ${
        typeof d.attempts === "number" ? d.attempts : "?"
      } essai(s)`;
    case "api_session_opened":
      return `client ${or(text(d.customerId))}, depuis ${or(text(d.ip))}${
        yes(d.signup) ? " (inscription)" : ""
      }`;
    case "api_session_closed":
      return `client ${or(text(d.customerId))}`;
    case "api_profile_updated":
      return `client ${or(text(d.customerId))}${
        yes(d.consents) ? " (autorisations comprises)" : ""
      }`;
    case "api_community_changed":
      return `client ${or(text(d.customerId))} → ${
        text(d.communityId) === null ? "aucune communauté" : text(d.communityId)
      }`;
    case "api_order_created":
    case "api_order_cancelled":
      return `client ${or(text(d.customerId))}, commande ${or(text(d.orderId))}`;
    case "api_message_created":
      return `client ${or(text(d.customerId))}, message ${or(text(d.messageId))}`;
    case "api_file_uploaded":
      return `client ${or(text(d.customerId))}, fichier ${or(text(d.uploadId))}`;
    case "api_file_rejected":
      return `client ${or(text(d.customerId))}, motif ${or(text(d.reason))}`;
    case "api_notification_sent":
    case "api_notification_failed":
      return `notification ${or(text(d.notificationId))}`;
    case "api_service_forbidden":
      return `depuis ${or(text(d.ip))}`;
    case "api_rate_limited":
      return `${or(text(d.subject))}, depuis ${or(text(d.ip))}`;
    case "mail_failed":
      return `sorte « ${or(text(d.kind))} »`;
    default:
      // Type inconnu : les détails restent lisibles plutôt que muets.
      return Object.entries(d)
        .map(([key, value]) => `${key} : ${or(text(value))}`)
        .join(", ");
  }
}
