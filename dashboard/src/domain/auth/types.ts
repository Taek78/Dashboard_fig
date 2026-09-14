import type { Role } from "@/domain/auth/roles";

/*
 * Utilisateur de la session courante : ce que verifySession() renvoie et ce que
 * toutes les Server Actions consomment. Inchangé depuis A1.3 : A7 a remplacé
 * l'implémentation (Auth.js), pas ce type.
 */
export type CurrentUser = { id: string; name: string; role: Role };

/** Compte du back-office tel que stocké (mock A7, table `users` en base). */
export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Jamais le mot de passe : le hachage scrypt de src/lib/password.ts. */
  passwordHash: string;
};

/*
 * Gestion des comptes (2026-09-14) : ce que l'écran /comptes manipule. Jamais le
 * hachage : il ne sort de la source que pour la vérification d'un mot de passe.
 */
export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Un compte désactivé ne peut plus se connecter ; ses traces restent. */
  active: boolean;
  /** ISO 8601. */
  createdAt: string;
};

/** Création par un administrateur : le hachage est calculé par l'action. */
export type NewUser = {
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
};

/** Modification partielle : nom, rôle, activation. */
export type UserPatch = {
  name?: string;
  role?: Role;
  active?: boolean;
};
