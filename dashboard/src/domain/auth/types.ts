import type { Role } from "@/domain/auth/roles";

/*
 * Utilisateur de la session courante : ce que verifySession() renvoie et ce que
 * toutes les Server Actions consomment (identité et rôle, rien d'autre).
 */
export type CurrentUser = { id: string; name: string; role: Role };

/** Compte du back-office tel que stocké (table `users`). */
export type UserAccount = {
  id: string;
  email: string;
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
 */
export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Un compte désactivé ne peut plus se connecter ; ses traces restent. */
  active: boolean;
  /** Faux tant que l'invitation n'a pas été acceptée. */
  hasPassword: boolean;
  /** ISO 8601. */
  createdAt: string;
};

/**
 * Création par un administrateur : sans mot de passe (null), la personne le
 * choisit par le lien d'invitation ; le seed d'amorçage fournit un hachage.
 */
export type NewUser = {
  email: string;
  name: string;
  role: Role;
  passwordHash: string | null;
};

/** Modification partielle : nom, rôle, activation. */
export type UserPatch = {
  name?: string;
  role?: Role;
  active?: boolean;
};

/** Bornes d'un mot de passe (lues par les formulaires, la politique et zod). */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;
/** À partir de cette longueur, une phrase de passe n'a plus de contrainte de composition. */
export const PASSPHRASE_LENGTH = 16;
/** Chiffres du code de récupération envoyé par mail. */
export const RECOVERY_CODE_LENGTH = 6;
