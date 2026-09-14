import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toManagedUser, toUserAccount } from "@/db/mappers";
import { users } from "@/db/schema";
import { sortUsers } from "@/domain/auth/rules";
import type { UsersSource } from "@/domain/auth/source";
import type { NewUser, UserPatch } from "@/domain/auth/types";

/*
 * Implémentation Drizzle du contrat UsersSource (B3, étendue le 2026-09-14 à
 * la gestion des comptes) : table `users`, e-mail comparé sans casse (index
 * unique sur lower(email)), comptes désactivés exclus de la connexion.
 * Le mot de passe n'est jamais lu autrement que par son hachage.
 */
const lowerEmail = (email: string) => email.trim().toLowerCase();

export const usersDb: UsersSource = {
  findUserByEmail: async (email: string) => {
    const [row] = await getDb()
      .select()
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, lowerEmail(email)),
          eq(users.active, true),
        ),
      )
      .limit(1);
    return row ? toUserAccount(row) : null;
  },

  findUserById: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toUserAccount(row) : null;
  },

  listUsers: async () => {
    const rows = await getDb().select().from(users);
    return sortUsers(rows.map(toManagedUser));
  },

  getUser: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toManagedUser(row) : null;
  },

  createUser: async (input: NewUser) => {
    const db = getDb();
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, lowerEmail(input.email)))
      .limit(1);
    if (taken) return "email_taken";
    const [row] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
      })
      .returning();
    if (!row) throw new Error("Insertion du compte sans ligne renvoyée.");
    return toManagedUser(row);
  },

  updateUser: async (id: string, patch: UserPatch) => {
    const [row] = await getDb()
      .update(users)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      })
      .where(eq(users.id, id))
      .returning();
    return row ? toManagedUser(row) : null;
  },

  setPassword: async (id: string, passwordHash: string) => {
    const updated = await getDb()
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  },
};
