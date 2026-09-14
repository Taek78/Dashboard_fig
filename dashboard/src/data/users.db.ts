import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toUserAccount } from "@/db/mappers";
import { users } from "@/db/schema";
import type { UsersSource } from "@/domain/auth/source";

/*
 * Implémentation Drizzle du contrat UsersSource (B3) : comptes du back-office
 * en table `users`, e-mail comparé sans casse, comptes désactivés ignorés.
 * Le mot de passe n'est jamais lu autrement que par son hachage.
 */
export const usersDb: UsersSource = {
  findUserByEmail: async (email: string) => {
    const [row] = await getDb()
      .select()
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, email.trim().toLowerCase()),
          eq(users.active, true),
        ),
      )
      .limit(1);
    return row ? toUserAccount(row) : null;
  },
};
