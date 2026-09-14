import type { Role } from "@/domain/auth/roles";

/*
 * Utilisateur de la session courante : ce que verifySession() renvoie et ce que
 * toutes les Server Actions consomment (identité et rôle, rien d'autre).
 */
export type CurrentUser = { id: string; name: string; role: Role };

/** Compte du back-office tel que stocké (store mémoire ou table `users`). */
export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Jamais le mot de passe : le hachage scrypt de src/lib/password.ts. */
  passwordHash: string;
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
