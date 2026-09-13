import type { UsersSource } from "@/domain/auth/source";
import type { UserAccount } from "@/domain/auth/types";

/*
 * Implémentation MOCK du contrat UsersSource. Aucun compte en dur : le store est
 * vide tant que la façade (src/data/users.ts) ne l'a pas seedé avec le compte
 * d'amorçage lu dans l'environnement. Un mot de passe dans le code serait publié
 * avec le dépôt.
 */
const store = new Map<string, UserAccount>();

export const usersMock: UsersSource = {
  findUserByEmail: async (email: string) => {
    const account = store.get(email.toLowerCase());
    return account ? structuredClone(account) : null;
  },
};

/** Hors contrat : remplissage par la façade (compte d'amorçage) ou par les tests. */
export function seedUsersMock(accounts: readonly UserAccount[]): void {
  store.clear();
  for (const a of accounts)
    store.set(a.email.toLowerCase(), structuredClone(a));
}

export function resetUsersMock(): void {
  store.clear();
}
