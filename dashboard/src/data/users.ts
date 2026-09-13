import "server-only";
import { seedUsersMock, usersMock } from "@/data/users.mock";
import type { UsersSource } from "@/domain/auth/source";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";

/*
 * FAÇADE des comptes. En A7 la seule source est le mock, seedé une fois avec le
 * compte d'amorçage de l'environnement (AUTH_BOOTSTRAP_*), mot de passe haché à
 * la volée. En piste B, `source` deviendra la table des comptes du dashboard.
 */
const source: UsersSource = usersMock;
let seeded: Promise<void> | null = null;

function ensureSeeded(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      const env = getEnv();
      seedUsersMock([
        {
          id: "usr-0001",
          email: env.AUTH_BOOTSTRAP_EMAIL,
          name: env.AUTH_BOOTSTRAP_NAME,
          role: "admin",
          passwordHash: await hashPassword(env.AUTH_BOOTSTRAP_PASSWORD),
        },
      ]);
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
