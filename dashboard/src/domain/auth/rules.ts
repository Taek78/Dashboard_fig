import type { ManagedUser, UserAccount, UserPatch } from "@/domain/auth/types";

/*
 * Règles pures de la gestion des comptes, testées dans
 * test/domain/auth/rules.test.ts. La Server Action les applique après avoir
 * relu la liste des comptes : le formulaire ne décide de rien.
 */

/** « Prénom Nom » affiché partout (session, mails, historique), sans espace superflu. */
export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

/**
 * Découpe un nom complet d'amorçage (AUTH_BOOTSTRAP_NAME, comptes de test) :
 * premier mot = prénom, le reste = nom ; un seul mot = nom seul, prénom vide.
 * La migration 0014 applique la même règle aux comptes existants.
 */
export function splitFullName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] ?? "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/** Copie triée par nom puis prénom (ordre français), les désactivés en fin de liste. */
export function sortUsers(users: readonly ManagedUser[]): ManagedUser[] {
  return users.toSorted(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.lastName.localeCompare(b.lastName, "fr") ||
      a.firstName.localeCompare(b.firstName, "fr"),
  );
}

/**
 * Les administrateurs actifs : destinataires des alertes par mail et contacts
 * nommés dans les avis à une personne. Un administrateur invité qui n'a pas
 * encore choisi son mot de passe n'en est pas un : il ne peut ni se
 * connecter ni gérer les comptes (décision du 2026-09-17, invitations).
 */
export function activeAdmins(users: readonly ManagedUser[]): ManagedUser[] {
  return users.filter((u) => u.active && u.role === "admin" && u.hasPassword);
}

export function countActiveAdmins(users: readonly ManagedUser[]): number {
  return activeAdmins(users).length;
}

/**
 * État de l'invitation d'un compte, à l'instant `nowMs` : « none » dès que le
 * mot de passe est choisi ; sinon « pending » tant que le dernier lien envoyé
 * est valable, « expired » passé ce délai (ou si le lien a déjà été purgé).
 */
export type InvitationState = "none" | "pending" | "expired";

export function invitationState(
  user: Pick<ManagedUser, "hasPassword" | "invitationExpiresAt">,
  nowMs: number,
): InvitationState {
  if (user.hasPassword) return "none";
  if (
    user.invitationExpiresAt !== null &&
    Date.parse(user.invitationExpiresAt) > nowMs
  ) {
    return "pending";
  }
  return "expired";
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
 * Vrai si `targetId` est le DERNIER administrateur actif : il ne peut être ni
 * désactivé, ni rétrogradé, ni supprimé, sinon plus personne ne pourrait gérer
 * les comptes. D'autres administrateurs peuvent être créés, puis désactivés ou
 * supprimés tant qu'il en reste un (décision du client, 2026-09-17).
 */
export function isLastActiveAdmin(
  users: readonly ManagedUser[],
  targetId: string,
): boolean {
  const admins = activeAdmins(users);
  return admins.length <= 1 && admins.some((u) => u.id === targetId);
}

/**
 * Vrai si appliquer `patch` à `targetId` laisserait le back-office sans aucun
 * administrateur actif : désactiver ou rétrograder le dernier admin est refusé.
 */
export function wouldRemoveLastAdmin(
  users: readonly ManagedUser[],
  targetId: string,
  patch: UserPatch,
): boolean {
  const losesAdmin =
    patch.active === false ||
    (patch.role !== undefined && patch.role !== "admin");
  return losesAdmin && isLastActiveAdmin(users, targetId);
}
