import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toManagedUser, toUserAccount } from "@/db/mappers";
import { users } from "@/db/schema";
import { sortUsers } from "@/domain/auth/rules";
import type { UsersSource } from "@/domain/auth/source";
import type { NewUser, UserPatch } from "@/domain/auth/types";

/*
 * Implémentation Drizzle du contrat UsersSource : table `users`, e-mail comparé
 * sans casse (index unique sur lower(email)), nom comparé sans casse ni accent
 * (index unique sur fig_normalize(name), la fonction SQL de la recherche), comptes
 * désactivés exclus de la connexion et du rappel d'adresse.
 * Le mot de passe n'est jamais lu autrement que par son hachage ; un compte
 * invité n'en a pas encore (null).
 */
const lowerEmail = (email: string) => email.trim().toLowerCase();

const sameName = (name: string) =>
  eq(sql`fig_normalize(${users.name})`, sql`fig_normalize(${name.trim()})`);

async function nameTakenByAnother(
  name: string,
  exceptId: string | null,
): Promise<boolean> {
  const [taken] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(
      exceptId === null
        ? sameName(name)
        : and(sameName(name), ne(users.id, exceptId)),
    )
    .limit(1);
  return taken !== undefined;
}

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

  findUserByName: async (name: string) => {
    const [row] = await getDb()
      .select()
      .from(users)
      .where(and(sameName(name), eq(users.active, true)))
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
    if (await nameTakenByAnother(input.name, null)) return "name_taken";
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
    if (
      patch.name !== undefined &&
      (await nameTakenByAnother(patch.name, id))
    ) {
      return "name_taken";
    }
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

  setPassword: async (id: string, passwordHash: string, changedAt: Date) => {
    const updated = await getDb()
      .update(users)
      .set({ passwordHash, passwordChangedAt: changedAt })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  },

  revokeSessions: async (id: string, at: Date) => {
    const updated = await getDb()
      .update(users)
      .set({ passwordChangedAt: at })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return updated.length > 0;
  },
};
