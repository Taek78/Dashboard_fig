import type {
  ManagedUser,
  NewUser,
  UserAccount,
  UserPatch,
} from "@/domain/auth/types";

/*
 * CONTRAT des comptes du back-office : mock (comptes de l'environnement) ou
 * table `users` (Drizzle). Types seulement.
 * - findUserByEmail / findUserById renvoient le compte AVEC son hachage, pour la
 *   vérification d'un mot de passe seulement ; findUserByEmail ignore les
 *   comptes désactivés (ils ne se connectent plus).
 * - listUsers / getUser / createUser / updateUser / setPassword servent l'écran
 *   /comptes et n'exposent jamais le hachage.
 * - createUser renvoie "email_taken" si l'e-mail existe déjà (sans casse).
 */
export type UsersSource = {
  findUserByEmail(email: string): Promise<UserAccount | null>;
  findUserById(id: string): Promise<UserAccount | null>;
  listUsers(): Promise<ManagedUser[]>;
  getUser(id: string): Promise<ManagedUser | null>;
  createUser(input: NewUser): Promise<ManagedUser | "email_taken">;
  updateUser(id: string, patch: UserPatch): Promise<ManagedUser | null>;
  setPassword(id: string, passwordHash: string): Promise<boolean>;
};
