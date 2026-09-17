import "server-only";
import { usersDb } from "@/data/users.db";
import type { UsersSource } from "@/domain/auth/source";

/*
 * FAÇADE des comptes du back-office (table users, créée par npm run db:seed puis gérée sur /comptes) : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (users.db.ts) ; la façade fixe le contrat
 * UsersSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const {
  findUserByEmail,
  findUserById,
  findUserByName,
  listUsers,
  getUser,
  createUser,
  updateUser,
  setPassword,
  revokeSessions,
}: UsersSource = usersDb;
