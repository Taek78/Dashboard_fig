import type { ManagedUser, UserPatch } from "@/domain/auth/types";

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

export function countActiveAdmins(users: readonly ManagedUser[]): number {
  return users.filter((u) => u.active && u.role === "admin").length;
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
