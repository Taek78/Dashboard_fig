import type { UsersSource } from "@/domain/auth/source";
import { sortUsers } from "@/domain/auth/rules";
import type {
  ManagedUser,
  NewUser,
  UserAccount,
  UserPatch,
} from "@/domain/auth/types";

/*
 * Implémentation MOCK du contrat UsersSource. Aucun compte en dur : le store est
 * vide tant que la façade (src/data/users.ts) ne l'a pas seedé avec les comptes
 * de l'environnement. Un mot de passe dans le code serait publié avec le dépôt.
 * Pas de latence simulée : la connexion et ses tests n'en veulent pas.
 */
type StoredUser = UserAccount & { active: boolean; createdAt: string };

const store = new Map<string, StoredUser>();
let counter = 0;
export const MOCK_CREATED_AT = "2026-09-14T08:00:00.000Z";

const toManaged = (u: StoredUser): ManagedUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
});

const toAccount = (u: StoredUser): UserAccount => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  passwordHash: u.passwordHash,
});

function byEmail(email: string): StoredUser | undefined {
  const wanted = email.trim().toLowerCase();
  for (const u of store.values()) {
    if (u.email.toLowerCase() === wanted) return u;
  }
  return undefined;
}

export const usersMock: UsersSource = {
  findUserByEmail: async (email: string) => {
    const u = byEmail(email);
    return u && u.active ? toAccount(u) : null;
  },

  findUserById: async (id: string) => {
    const u = store.get(id);
    return u ? toAccount(u) : null;
  },

  listUsers: async () => sortUsers([...store.values()].map(toManaged)),

  getUser: async (id: string) => {
    const u = store.get(id);
    return u ? toManaged(u) : null;
  },

  createUser: async (input: NewUser) => {
    if (byEmail(input.email)) return "email_taken";
    counter += 1;
    const created: StoredUser = {
      id: `usr-m-${counter}`,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      active: true,
      createdAt: MOCK_CREATED_AT,
    };
    store.set(created.id, created);
    return toManaged(created);
  },

  updateUser: async (id: string, patch: UserPatch) => {
    const u = store.get(id);
    if (!u) return null;
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.role !== undefined) u.role = patch.role;
    if (patch.active !== undefined) u.active = patch.active;
    return toManaged(u);
  },

  setPassword: async (id: string, passwordHash: string) => {
    const u = store.get(id);
    if (!u) return false;
    u.passwordHash = passwordHash;
    return true;
  },
};

/** Hors contrat : remplissage par la façade (comptes de l'environnement) ou par les tests. */
export function seedUsersMock(accounts: readonly UserAccount[]): void {
  store.clear();
  counter = 0;
  for (const a of accounts) {
    store.set(a.id, {
      ...structuredClone(a),
      active: true,
      createdAt: MOCK_CREATED_AT,
    });
  }
}

export function resetUsersMock(): void {
  store.clear();
  counter = 0;
}
