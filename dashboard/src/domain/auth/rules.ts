import type { ManagedUser, UserAccount, UserPatch } from "@/domain/auth/types";

/*
 * Règles pures de la gestion des comptes, testées dans
 * test/domain/auth/rules.test.ts. La Server Action les applique après avoir
 * relu la liste des comptes : le formulaire ne décide de rien.
 */

/** Copie triée par nom (ordre français), les désactivés en fin de liste. */
export function sortUsers(users: readonly ManagedUser[]): ManagedUser[] {
  return users.toSorted(
    (a, b) =>
      Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "fr"),
  );
}

/** Les administrateurs actifs : destinataires des alertes de sécurité par mail. */
export function activeAdmins(users: readonly ManagedUser[]): ManagedUser[] {
  return users.filter((u) => u.active && u.role === "admin");
}

export function countActiveAdmins(users: readonly ManagedUser[]): number {
  return activeAdmins(users).length;
}

/**
 * Une session ouverte à `signedInAt` (ms) reste valable tant que le compte est
 * actif et que son mot de passe n'a pas changé depuis (ni verrouillage) :
 * changer un mot de passe, verrouiller ou désactiver un compte ferme donc ses
 * sessions à la requête suivante. Un jeton sans date d'ouverture (ancien
 * format) vaut 0 : fermé au premier changement.
 */
export function isSessionAlive(
  account: Pick<UserAccount, "active" | "passwordChangedAt"> | null,
  signedInAt: number | undefined,
): boolean {
  if (!account || !account.active) return false;
  if (account.passwordChangedAt === null) return true;
  return (signedInAt ?? 0) >= Date.parse(account.passwordChangedAt);
}

/**
 * Vrai si appliquer `patch` à `targetId` laisserait le back-office sans aucun
 * administrateur actif : désactiver ou rétrograder le dernier admin est refusé,
 * sinon plus personne ne pourrait gérer les comptes.
 */
export function wouldRemoveLastAdmin(
  users: readonly ManagedUser[],
  targetId: string,
  patch: UserPatch,
): boolean {
  const target = users.find((u) => u.id === targetId);
  if (!target || !target.active || target.role !== "admin") return false;
  const losesAdmin =
    patch.active === false ||
    (patch.role !== undefined && patch.role !== "admin");
  return losesAdmin && countActiveAdmins(users) <= 1;
}
