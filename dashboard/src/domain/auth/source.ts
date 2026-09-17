import type { AuthToken, AuthTokenKind } from "@/domain/auth/tokens";
import type {
  ManagedUser,
  NewUser,
  UserAccount,
  UserPatch,
} from "@/domain/auth/types";

/*
 * CONTRAT des comptes du back-office, implémenté par la table `users`
 * (src/data/users.db.ts). Types seulement.
 * - findUserByEmail / findUserById / findUsersByLastName renvoient le compte
 *   AVEC son hachage, pour la vérification d'un mot de passe seulement ;
 *   findUserByEmail et findUsersByLastName ignorent les comptes désactivés
 *   (ils ne se connectent plus). findUsersByLastName compare le NOM seul,
 *   sans casse ni accent (fig_normalize) : il sert au rappel de l'adresse
 *   e-mail, et deux homonymes reçoivent chacun le leur.
 * - listUsers / getUser / createUser / updateUser / deleteUser / setPassword
 *   servent l'écran /comptes et n'exposent jamais le hachage ; l'e-mail ne
 *   se modifie pas (aucun patch ne le porte) ; deleteUser est définitif
 *   (jetons en cascade), vrai si une ligne a été supprimée.
 * - createUser renvoie "email_taken" si l'e-mail existe déjà (sans casse),
 *   "name_taken" si le couple prénom + nom existe déjà (sans casse ni
 *   accent) ; updateUser renvoie "name_taken" dans le même cas.
 * - setPassword pose aussi passwordChangedAt = changedAt (horloge de
 *   l'application, la même que celle des sessions) ; revokeSessions ne pose
 *   que cet instant, sans toucher au mot de passe (verrouillage, désactivation).
 */
export type UsersSource = {
  findUserByEmail(email: string): Promise<UserAccount | null>;
  findUserById(id: string): Promise<UserAccount | null>;
  findUsersByLastName(lastName: string): Promise<UserAccount[]>;
  listUsers(): Promise<ManagedUser[]>;
  getUser(id: string): Promise<ManagedUser | null>;
  createUser(
    input: NewUser,
  ): Promise<ManagedUser | "email_taken" | "name_taken">;
  updateUser(
    id: string,
    patch: UserPatch,
  ): Promise<ManagedUser | null | "name_taken">;
  deleteUser(id: string): Promise<boolean>;
  setPassword(
    id: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<boolean>;
  revokeSessions(id: string, at: Date): Promise<boolean>;
};

/*
 * CONTRAT des jetons d'authentification (table auth_tokens,
 * src/data/auth-tokens.db.ts) : codes de récupération, liens de verrouillage
 * et d'invitation (règles dans domain/auth/tokens.ts).
 * - createToken consomme d'abord les jetons actifs de même sorte pour ce compte
 *   si la sorte est exclusive, et purge les jetons expirés depuis plus d'un jour ;
 * - findActiveToken : le dernier jeton non consommé d'une sorte pour un compte
 *   (le code saisi lui est comparé) ; findTokenByHash : un lien, par son HMAC ;
 * - recordTokenAttempt incrémente atomiquement et renvoie le nouveau total ;
 * - consumeToken est conditionnel (une seule consommation, même en parallèle).
 */
export type NewAuthToken = {
  kind: AuthTokenKind;
  userId: string;
  secretHash: string;
  expiresAt: Date;
  requestedIp: string | null;
};

export type AuthTokensSource = {
  createToken(input: NewAuthToken): Promise<AuthToken>;
  findActiveToken(
    kind: AuthTokenKind,
    userId: string,
  ): Promise<AuthToken | null>;
  findTokenByHash(
    kind: AuthTokenKind,
    secretHash: string,
  ): Promise<AuthToken | null>;
  recordTokenAttempt(id: string): Promise<number>;
  consumeToken(id: string, at: Date): Promise<boolean>;
};
