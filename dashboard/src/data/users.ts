import "server-only";
import { selectSource } from "@/data/select-source";
import { usersDb } from "@/data/users.db";
import { seedUsersMock, usersMock } from "@/data/users.mock";
import type { UsersSource } from "@/domain/auth/source";
import type { UserAccount } from "@/domain/auth/types";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";

/*
 * FAÇADE des comptes du back-office.
 * - DATA_SOURCE=mock : le store mémoire est seedé une fois avec le compte
 *   d'amorçage de l'environnement (AUTH_BOOTSTRAP_*, admin) et, s'il est
 *   renseigné, le compte gestionnaire (AUTH_MANAGER_*), mots de passe hachés à
 *   la volée ; les comptes créés ensuite vivent en mémoire jusqu'au redémarrage.
 * - DATA_SOURCE=db : la table `users` (créée par `npm run db:seed` avec ces
 *   mêmes comptes, puis gérée par /comptes) ; l'environnement n'est plus consulté.
 */
const source = (): UsersSource => selectSource("comptes", usersMock, usersDb);
let seeded: Promise<void> | null = null;

function ensureSeeded(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      const env = getEnv();
      // Déjà refusé au démarrage par env-schema ; on le revérifie ici au cas où.
      if (env.NODE_ENV === "production" && env.AUTH_ALLOW_BOOTSTRAP !== "1") {
        throw new Error(
          "Compte d'amorçage désactivé en production (AUTH_ALLOW_BOOTSTRAP absent).",
        );
      }
      const accounts: UserAccount[] = [
        {
          id: "usr-0001",
          email: env.AUTH_BOOTSTRAP_EMAIL,
          name: env.AUTH_BOOTSTRAP_NAME,
          role: "admin",
          passwordHash: await hashPassword(env.AUTH_BOOTSTRAP_PASSWORD),
        },
      ];
      if (env.AUTH_MANAGER_EMAIL && env.AUTH_MANAGER_PASSWORD) {
        accounts.push({
          id: "usr-0002",
          email: env.AUTH_MANAGER_EMAIL,
          name: env.AUTH_MANAGER_NAME ?? "Gestionnaire",
          role: "gestionnaire",
          passwordHash: await hashPassword(env.AUTH_MANAGER_PASSWORD),
        });
      }
      seedUsersMock(accounts);
    })();
  }
  return seeded;
}

async function ready(): Promise<UsersSource> {
  if (getEnv().DATA_SOURCE === "mock") await ensureSeeded();
  return source();
}

export const findUserByEmail: UsersSource["findUserByEmail"] = async (email) =>
  (await ready()).findUserByEmail(email);
export const findUserById: UsersSource["findUserById"] = async (id) =>
  (await ready()).findUserById(id);
export const listUsers: UsersSource["listUsers"] = async () =>
  (await ready()).listUsers();
export const getUser: UsersSource["getUser"] = async (id) =>
  (await ready()).getUser(id);
export const createUser: UsersSource["createUser"] = async (input) =>
  (await ready()).createUser(input);
export const updateUser: UsersSource["updateUser"] = async (id, patch) =>
  (await ready()).updateUser(id, patch);
export const setPassword: UsersSource["setPassword"] = async (id, hash) =>
  (await ready()).setPassword(id, hash);
