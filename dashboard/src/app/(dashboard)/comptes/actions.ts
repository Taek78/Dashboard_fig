"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createToken } from "@/data/auth-tokens";
import { trySendMail } from "@/data/mail";
import { findPasswordProblem } from "@/data/passwords";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser, reopenSession } from "@/data/session";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  revokeSessions,
  setPassword,
  updateUser,
} from "@/data/users";
import {
  accountActivatedMail,
  accountDeactivatedMail,
  accountDeletedMail,
  adminAccountActivatedMail,
  invitationMail,
  type AccountSummary,
} from "@/domain/auth/mails";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import { canManageUsers } from "@/domain/auth/roles";
import {
  activeAdmins,
  isLastActiveAdmin,
  wouldRemoveLastAdmin,
} from "@/domain/auth/rules";
import {
  cancelInvitationSchema,
  createUserSchema,
  deleteUserSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  sendPasswordLinkSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/domain/auth/schemas";
import { AUTH_TOKEN_RULES, tokenExpiresAt } from "@/domain/auth/tokens";
import {
  ACCOUNT_DELETE_CONFIRM_WORD,
  type CurrentUser,
  type ManagedUser,
} from "@/domain/auth/types";
import type { ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/app-url";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { generateLinkToken, hashSecret } from "@/lib/secrets";

/*
 * Server Actions de la gestion des comptes, réservées à
 * l'administrateur. Même discipline : session → rôle → zod → relecture →
 * règles (jamais se désactiver ni se supprimer soi-même, jamais toucher au
 * dernier administrateur actif) → écriture → journal → revalidation. Les mots
 * de passe sont hachés ici et n'apparaissent dans aucun message ni journal.
 *
 * Depuis le 2026-09-17, un compte se crée SANS mot de passe : la personne le
 * choisit par un lien d'invitation (48 h, une seule fois) envoyé après la
 * réponse ; « Envoyer un lien » renvoie ce lien à tout compte actif (compte
 * jamais activé, ou mot de passe à remplacer). Tant que le mot de passe
 * n'existe pas, le compte est EN ATTENTE D'ACTIVATION : « Annuler
 * l'invitation » le supprime (jamais activé, rien à conserver), et le lien
 * cesse de fonctionner. Quand il s'active (lien accepté, ou dépannage ici), la
 * personne et les administrateurs reçoivent un avis d'activation. « Nouveau
 * mot de passe » reste le dépannage quand le mail ne passe pas : il applique
 * la même politique (règles pures puis fuites connues). Désactiver un compte
 * ferme ses sessions sur-le-champ ; changer un mot de passe aussi (le sien
 * est rouvert). Un compte porte un prénom et un nom (le nom seul sert au
 * rappel de l'adresse) ; son e-mail se lit mais ne se modifie pas. Supprimer
 * un compte (mot SUPPRIMER) est définitif : ses jetons partent en cascade, ses
 * sessions tombent à la requête suivante, l'historique des commandes garde le
 * nom écrit. Désactiver ou supprimer un compte envoie un mail à la personne,
 * après la réponse (after) : la date, ce que cela change, l'administrateur qui
 * agit, nommé avec son adresse.
 */
const MESSAGES = {
  forbidden: "Seul un administrateur peut gérer les comptes.",
  invalid:
    "Vérifiez la saisie : prénom, nom (2 caractères au moins), e-mail valide, rôle.",
  invalidPassword: `Vérifiez la saisie : mot de passe de ${PASSWORD_MIN_LENGTH} caractères au moins.`,
  confirm: `Tapez ${ACCOUNT_DELETE_CONFIRM_WORD} pour confirmer la suppression.`,
  emailTaken: "Un compte existe déjà avec cet e-mail.",
  nameTaken: "Un compte porte déjà ce prénom et ce nom.",
  notFound: "Ce compte n'existe plus.",
  inactive: "Ce compte est désactivé : réactivez-le avant d'envoyer un lien.",
  activated:
    "Ce compte est déjà activé : pour le retirer, utilisez « Supprimer ce compte ».",
  self: "Vous ne pouvez pas désactiver votre propre compte.",
  selfDelete: "Vous ne pouvez pas supprimer votre propre compte.",
  lastAdmin:
    "Impossible : ce compte est le dernier administrateur actif du back-office.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

/** L'administrateur qui agit, avec son adresse : le contact nommé dans l'avis à la personne. */
function contactOf(
  users: readonly ManagedUser[],
  user: CurrentUser,
): AccountSummary {
  const me = users.find((u) => u.id === user.id);
  return { name: user.name, email: me?.email ?? "" };
}

/** Crée le lien d'invitation, programme son envoi après la réponse, journalise. */
async function issueInvitation(
  target: ManagedUser,
  by: CurrentUser,
  reason: "creation" | "reset",
): Promise<void> {
  const secret = generateLinkToken();
  await createToken({
    kind: "invitation",
    userId: target.id,
    secretHash: hashSecret(secret, getEnv().AUTH_SECRET),
    expiresAt: tokenExpiresAt("invitation", Date.now()),
    requestedIp: null,
  });
  const mail = invitationMail({
    to: { email: target.email, name: target.name },
    url: appUrl(`/connexion/invitation?jeton=${secret}`),
    byName: by.name,
    reason,
  });
  after(() => trySendMail("invitation", mail));
  logSecurity({ type: "invitation_sent", userId: by.id, targetId: target.id });
}

/**
 * Avis d'activation, après la réponse : à la personne (tout ce qu'il faut
 * pour se connecter) et à chaque administrateur actif (pour information).
 * `by` : l'administrateur qui a attribué le mot de passe (dépannage).
 */
function announceActivation(
  target: ManagedUser,
  users: readonly ManagedUser[],
  at: string,
  by: string,
): void {
  const admins = activeAdmins(users).map((a) => ({
    name: a.name,
    email: a.email,
  }));
  const account = { name: target.name, email: target.email, role: target.role };
  const comptesUrl = appUrl("/comptes");
  const loginUrl = appUrl("/connexion");
  after(async () => {
    await trySendMail(
      "account_activated",
      accountActivatedMail({
        to: { email: target.email, name: target.name },
        at,
        role: target.role,
        loginUrl,
        admins,
        by,
      }),
    );
    await Promise.all(
      admins.map((admin) =>
        trySendMail(
          "admin_account_activated",
          adminAccountActivatedMail({ to: admin, account, at, comptesUrl, by }),
        ),
      ),
    );
  });
}

export async function createAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "createAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };

  try {
    const created = await createUser({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      passwordHash: null,
    });
    if (created === "email_taken") {
      return { status: "error", message: MESSAGES.emailTaken };
    }
    if (created === "name_taken") {
      return { status: "error", message: MESSAGES.nameTaken };
    }
    logSecurity({
      type: "account_created",
      userId: user.id,
      targetId: created.id,
      role: created.role,
    });
    await issueInvitation(created, user, "creation");
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${created.name} » créé, en attente d'activation : un lien pour choisir son mot de passe lui a été envoyé (${created.email}, valable ${AUTH_TOKEN_RULES.invitation.validity}).`,
    };
  } catch (error) {
    console.error("[createAccount]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function sendPasswordLink(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "sendPasswordLink",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = sendPasswordLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };

  try {
    const target = await getUser(parsed.data.userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    if (!target.active) return { status: "error", message: MESSAGES.inactive };
    await issueInvitation(
      target,
      user,
      target.hasPassword ? "reset" : "creation",
    );
    // La carte affiche la nouvelle validité du lien.
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Lien envoyé à « ${target.name} » (${target.email}), valable ${AUTH_TOKEN_RULES.invitation.validity}.`,
    };
  } catch (error) {
    console.error(
      "[sendPasswordLink]",
      { userId: user.id, targetId: parsed.data.userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function cancelInvitation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "cancelInvitation",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = cancelInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId } = parsed.data;

  try {
    const target = await getUser(userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    // Un compte activé a un historique et des sessions : c'est une suppression, avec son mot.
    if (target.hasPassword) {
      return { status: "error", message: MESSAGES.activated };
    }
    const deleted = await deleteUser(userId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "invitation_cancelled",
      userId: user.id,
      targetId: userId,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Invitation de « ${target.name} » annulée : le compte est supprimé et le lien reçu ne fonctionne plus.`,
    };
  } catch (error) {
    console.error(
      "[cancelInvitation]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function updateAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "updateAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, firstName, lastName, role } = parsed.data;

  try {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (wouldRemoveLastAdmin(users, userId, { role })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const updated = await updateUser(userId, { firstName, lastName, role });
    if (updated === "name_taken") {
      return { status: "error", message: MESSAGES.nameTaken };
    }
    if (!updated) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "account_updated",
      userId: user.id,
      targetId: updated.id,
      role: updated.role,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${updated.name} » enregistré.`,
    };
  } catch (error) {
    console.error(
      "[updateAccount]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function setAccountActive(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "setAccountActive",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = setUserActiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, active } = parsed.data;
  if (!active && userId === user.id) {
    return { status: "error", message: MESSAGES.self };
  }

  try {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (wouldRemoveLastAdmin(users, userId, { active })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const updated = await updateUser(userId, { active });
    if (!updated || updated === "name_taken") {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (!active) {
      const at = new Date();
      await revokeSessions(userId, at);
      const mail = accountDeactivatedMail({
        to: { email: updated.email, name: updated.name },
        at: at.toISOString(),
        admin: contactOf(users, user),
      });
      after(() => trySendMail("account_deactivated", mail));
    }
    logSecurity({
      type: active ? "account_reactivated" : "account_deactivated",
      userId: user.id,
      targetId: updated.id,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: active
        ? `Compte « ${updated.name} » réactivé.`
        : `Compte « ${updated.name} » désactivé : il ne peut plus se connecter, ses sessions sont fermées et un message l'en informe.`,
    };
  } catch (error) {
    console.error(
      "[setAccountActive]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function deleteAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "deleteAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = deleteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.confirm };
  const { userId } = parsed.data;
  if (userId === user.id) {
    return { status: "error", message: MESSAGES.selfDelete };
  }

  try {
    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    if (isLastActiveAdmin(users, userId)) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const deleted = await deleteUser(userId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "account_deleted", userId: user.id, targetId: userId });
    // À l'ancienne adresse du compte : un nouveau compte peut y être créé, sur invitation.
    const mail = accountDeletedMail({
      to: { email: target.email, name: target.name },
      at: new Date().toISOString(),
      admin: contactOf(users, user),
    });
    after(() => trySendMail("account_deleted", mail));
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${target.name} » supprimé ; un message l'en informe à son ancienne adresse.`,
    };
  } catch (error) {
    console.error(
      "[deleteAccount]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function resetAccountPassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "resetAccountPassword",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalidPassword };
  }
  const { userId, password } = parsed.data;

  try {
    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    const problem = await findPasswordProblem(password, {
      email: target.email,
      name: target.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }
    const changedAt = new Date();
    const ok = await setPassword(
      userId,
      await hashPassword(password),
      changedAt,
    );
    if (!ok) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "password_reset", userId: user.id, targetId: userId });
    if (userId === user.id) await reopenSession(target.email, password);
    // Premier mot de passe d'un compte invité : c'est son activation.
    const activated = !target.hasPassword;
    if (activated) {
      announceActivation(target, users, changedAt.toISOString(), user.name);
    }
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: activated
        ? `Compte « ${target.name} » activé avec ce mot de passe ; un message l'en informe, ainsi que les administrateurs. Communiquez-le par un canal sûr : la personne devra le changer à sa première connexion.`
        : `Nouveau mot de passe enregistré pour « ${target.name} » ; ses sessions sont fermées. Communiquez-le par un canal sûr, ou préférez « Envoyer un lien ».`,
    };
  } catch (error) {
    console.error(
      "[resetAccountPassword]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}
