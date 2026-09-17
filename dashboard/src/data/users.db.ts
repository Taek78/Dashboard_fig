import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toManagedUser, toUserAccount } from "@/db/mappers";
import { users } from "@/db/schema";
import { fullName, sortUsers } from "@/domain/auth/rules";
import type { UsersSource } from "@/domain/auth/source";
import type { NewUser, UserPatch } from "@/domain/auth/types";

/*
 * Implémentation Drizzle du contrat UsersSource : table `users`, e-mail comparé
 * sans casse (index unique sur lower(email)), prénom et nom comparés ensemble
 * sans casse ni accent (index unique sur fig_normalize(prénom || ' ' || nom),
 * la fonction SQL de la recherche), nom seul indexé de même pour le rappel
 * d'adresse, comptes désactivés exclus de la connexion et du rappel.
 * Le mot de passe n'est jamais lu autrement que par son hachage ; un compte
 * invité n'en a pas encore (null). L'e-mail ne se modifie jamais.
 */
const lowerEmail = (email: string) => email.trim().toLowerCase();

/** Même prénom et nom, sans casse ni accent : l'expression de l'index unique. */
const sameFullName = (firstName: string, lastName: string) =>
  eq(
    sql`fig_normalize(btrim(${users.firstName} || ' ' || ${users.lastName}))`,
    sql`fig_normalize(${fullName({ firstName, lastName })})`,
  );

/** Même nom, sans casse ni accent (index users_last_name_normalized_idx). */
const sameLastName = (lastName: string) =>
  eq(
    sql`fig_normalize(${users.lastName})`,
    sql`fig_normalize(${lastName.trim()})`,
  );

async function nameTakenByAnother(
  firstName: string,
  lastName: string,
  exceptId: string | null,
): Promise<boolean> {
  const [taken] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(
      exceptId === null
        ? sameFullName(firstName, lastName)
        : and(sameFullName(firstName, lastName), ne(users.id, exceptId)),
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

  findUsersByLastName: async (lastName: string) => {
    const rows = await getDb()
      .select()
      .from(users)
      .where(and(sameLastName(lastName), eq(users.active, true)));
    return rows.map(toUserAccount);
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
    if (await nameTakenByAnother(input.firstName, input.lastName, null)) {
      return "name_taken";
    }
    const [row] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        passwordHash: input.passwordHash,
      })
      .returning();
    if (!row) throw new Error("Insertion du compte sans ligne renvoyée.");
    return toManagedUser(row);
  },

  updateUser: async (id: string, patch: UserPatch) => {
    const db = getDb();
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      // Le couple effectif après modification : ce qui n'est pas dans le patch est relu.
      const [current] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!current) return null;
      const firstName = patch.firstName ?? current.firstName;
      const lastName = patch.lastName ?? current.lastName;
      if (await nameTakenByAnother(firstName, lastName, id)) {
        return "name_taken";
      }
    }
    const [row] = await db
      .update(users)
      .set({
        ...(patch.firstName !== undefined
          ? { firstName: patch.firstName }
          : {}),
        ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      })
      .where(eq(users.id, id))
      .returning();
    return row ? toManagedUser(row) : null;
  },

  deleteUser: async (id: string) => {
    // Les jetons du compte partent en cascade ; l'historique des commandes garde le nom écrit.
    const deleted = await getDb()
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return deleted.length > 0;
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
