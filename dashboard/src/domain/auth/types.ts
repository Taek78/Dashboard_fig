import type { Role } from "@/domain/auth/roles";
import type { MailFailureReason } from "@/domain/mail/failure";

/*
 * Utilisateur de la session courante : ce que verifySession() renvoie et ce que
 * toutes les Server Actions consomment (identité et rôle, rien d'autre).
 * `name` est l'affichage « Prénom Nom ».
 */
export type CurrentUser = { id: string; name: string; role: Role };

/** Compte du back-office tel que stocké (table `users`). */
export type UserAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** « Prénom Nom », dérivé par le mapper (fullName) : affiché partout, jamais stocké. */
  name: string;
  role: Role;
  /**
   * Jamais le mot de passe : le hachage scrypt de src/lib/password.ts. Null
   * tant que la personne n'a pas choisi son mot de passe par le lien
   * d'invitation : le compte ne peut pas se connecter.
   */
  passwordHash: string | null;
  active: boolean;
  /**
   * Dernier changement de mot de passe ou verrouillage (ISO 8601) : toute
   * session ouverte avant cet instant est refusée (isSessionAlive).
   */
  passwordChangedAt: string | null;
};

/*
 * Gestion des comptes : ce que l'écran /comptes manipule. Jamais le
 * hachage : il ne sort de la source que pour la vérification d'un mot de passe.
 * L'e-mail se lit mais ne se modifie pas (aucun patch ne le porte).
 */
export type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** « Prénom Nom », dérivé. */
  name: string;
  role: Role;
  /** Un compte désactivé ne peut plus se connecter ; ses traces restent. */
  active: boolean;
  /** Faux tant que l'invitation n'a pas été acceptée. */
  hasPassword: boolean;
  /**
   * Expiration (ISO 8601) du dernier lien d'invitation envoyé, null si aucun
   * (ou déjà purgé). Ne compte que sans mot de passe : c'est l'état
   * « en attente » ou « expirée » de l'invitation (invitationState).
   */
  invitationExpiresAt: string | null;
  /**
   * Ce qu'a donné le dernier envoi d'invitation : confirmé par le
   * fournisseur, ou échoué avec sa cause (domain/mail/failure.ts) ; null si
   * aucun envoi n'a encore été tenté (comptes d'avant la migration 0017, ou
   * amorcés par le seed). L'écran le dit sur la carte et propose de
   * réessayer : sans lien, la personne ne peut pas entrer.
   */
  invitationMail: InvitationMailState | null;
  /** ISO 8601. */
  createdAt: string;
};

/** ISO 8601 dans les deux cas : l'instant de l'envoi confirmé ou de l'échec. */
export type InvitationMailState =
  | { state: "sent"; at: string }
  | { state: "failed"; at: string; reason: MailFailureReason };

/**
 * Compte dont l'invitation vient d'être constatée expirée par le balayage
 * (expireInvitations) : de quoi prévenir la personne et les administrateurs.
 */
export type ExpiredInvitation = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Expiration du lien (ISO 8601). */
  expiresAt: string;
};

/**
 * Création par un administrateur : sans mot de passe (null), la personne le
 * choisit par le lien d'invitation ; le seed d'amorçage fournit un hachage.
 */
export type NewUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  passwordHash: string | null;
};

/** Modification partielle : prénom, nom, rôle, activation (jamais l'e-mail). */
export type UserPatch = {
  firstName?: string;
  lastName?: string;
  role?: Role;
  active?: boolean;
};

/** Mot à taper pour supprimer un compte (exigé par l'écran et par zod). */
export const ACCOUNT_DELETE_CONFIRM_WORD = "SUPPRIMER";

/** Bornes d'un mot de passe (lues par les formulaires, la politique et zod). */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;
/** À partir de cette longueur, une phrase de passe n'a plus de contrainte de composition. */
export const PASSPHRASE_LENGTH = 16;
/** Chiffres du code de récupération envoyé par mail. */
export const RECOVERY_CODE_LENGTH = 6;
