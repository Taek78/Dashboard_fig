import type { Role } from "@/domain/auth/roles";

/*
 * Utilisateur de la session courante : ce que verifySession() renvoie et ce que
 * toutes les Server Actions consomment. Inchangé depuis A1.3 : A7 a remplacé
 * l'implémentation (Auth.js), pas ce type.
 */
export type CurrentUser = { id: string; name: string; role: Role };

/** Compte du back-office tel que stocké (mock A7, table dashboard_* en piste B). */
export type UserAccount = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Jamais le mot de passe : le hachage scrypt de src/lib/password.ts. */
  passwordHash: string;
};
