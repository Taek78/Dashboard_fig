import "server-only";
import { seedUsersMock, usersMock } from "@/data/users.mock";
import type { UsersSource } from "@/domain/auth/source";
import type { UserAccount } from "@/domain/auth/types";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";

/*
 * FAÇADE des comptes. En A7 la seule source est le mock, seedé une fois avec le
 * compte d'amorçage de l'environnement (AUTH_BOOTSTRAP_*, admin) et, s'il est
 * renseigné, le compte gestionnaire (AUTH_MANAGER_*), mots de passe hachés à la
 * volée. En piste B, `source` deviendra la table des comptes du dashboard.
 */
const source: UsersSource = usersMock;
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

export const findUserByEmail: UsersSource["findUserByEmail"] = async (
  email,
) => {
  await ensureSeeded();
  return source.findUserByEmail(email);
};
