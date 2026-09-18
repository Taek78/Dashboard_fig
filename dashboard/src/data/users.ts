import "server-only";
import { usersDb } from "@/data/users.db";
import { invitationState, type InvitationState } from "@/domain/auth/rules";
import type { UsersSource } from "@/domain/auth/source";
import type { ManagedUser } from "@/domain/auth/types";

/*
 * FAÇADE des comptes du back-office (table users, créée par npm run db:seed puis gérée sur /comptes) : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (users.db.ts) ; la façade fixe le contrat
 * UsersSource et `server-only` (un composant client qui l'importerait casse le build).
 *
 * listUsersWithInvitations : la liste avec l'état de chaque invitation (aucune,
 * en attente, expirée) à l'instant de la lecture. L'horloge est lue ICI, pas
 * dans la page : un composant serveur doit rester pur (pas de Date.now()
 * pendant le rendu).
 */
export type ManagedUserWithInvitation = ManagedUser & {
  invitation: InvitationState;
};

export async function listUsersWithInvitations(): Promise<
  ManagedUserWithInvitation[]
> {
  const nowMs = Date.now();
  return (await usersDb.listUsers()).map((user) => ({
    ...user,
    invitation: invitationState(user, nowMs),
  }));
}

export const {
  findUserByEmail,
  findUserById,
  findUsersByLastName,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setPassword,
  revokeSessions,
  expireInvitations,
  setInvitationMailOutcome,
}: UsersSource = usersDb;
