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
  getUser,
  listUsers,
  revokeSessions,
  setPassword,
  updateUser,
} from "@/data/users";
import { invitationMail } from "@/domain/auth/mails";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import { canManageUsers } from "@/domain/auth/roles";
import { wouldRemoveLastAdmin } from "@/domain/auth/rules";
import {
  createUserSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  sendPasswordLinkSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/domain/auth/schemas";
import { AUTH_TOKEN_RULES, tokenExpiresAt } from "@/domain/auth/tokens";
import type { CurrentUser, ManagedUser } from "@/domain/auth/types";
import type { ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/app-url";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { generateLinkToken, hashSecret } from "@/lib/secrets";

/*
 * Server Actions de la gestion des comptes, réservées à
 * l'administrateur. Même discipline : session → rôle → zod → relecture →
 * règles (jamais se désactiver soi-même, jamais retirer le dernier admin) →
 * écriture → journal → revalidation. Les mots de passe sont hachés ici et
 * n'apparaissent dans aucun message ni journal.
 *
 * Depuis le 2026-09-17, un compte se crée SANS mot de passe : la personne le
 * choisit par un lien d'invitation (48 h, une seule fois) envoyé après la
 * réponse ; « Envoyer un lien » renvoie ce lien à tout compte actif (compte
 * jamais activé, ou mot de passe à remplacer). « Nouveau mot de passe » reste
 * le dépannage quand le mail ne passe pas : il applique la même politique
 * (règles pures puis fuites connues). Désactiver un compte ferme ses sessions
 * sur-le-champ ; changer un mot de passe aussi (le sien est rouvert).
 */
const MESSAGES = {
  forbidden: "Seul un administrateur peut gérer les comptes.",
  invalid:
    "Vérifiez la saisie : e-mail valide, nom (2 caractères au moins), rôle.",
  invalidPassword: `Vérifiez la saisie : mot de passe de ${PASSWORD_MIN_LENGTH} caractères au moins.`,
  emailTaken: "Un compte existe déjà avec cet e-mail.",
  nameTaken:
    "Un compte porte déjà ce nom. Le nom sert au rappel de l'adresse e-mail : il doit être unique.",
  notFound: "Ce compte n'existe plus.",
  inactive: "Ce compte est désactivé : réactivez-le avant d'envoyer un lien.",
  self: "Vous ne pouvez pas désactiver votre propre compte.",
  lastAdmin:
    "Impossible : ce compte est le dernier administrateur actif du back-office.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

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
      name: parsed.data.name,
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
      message: `Compte « ${created.name} » créé : un lien pour choisir son mot de passe lui a été envoyé (${created.email}, valable ${AUTH_TOKEN_RULES.invitation.validity}).`,
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
  const { userId, name, role } = parsed.data;

  try {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (wouldRemoveLastAdmin(users, userId, { role })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const updated = await updateUser(userId, { name, role });
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
    if (!active) await revokeSessions(userId, new Date());
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
        : `Compte « ${updated.name} » désactivé : il ne peut plus se connecter et ses sessions sont fermées.`,
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
    const target = await getUser(userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    const problem = await findPasswordProblem(password, {
      email: target.email,
      name: target.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }
    const ok = await setPassword(
      userId,
      await hashPassword(password),
      new Date(),
    );
    if (!ok) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "password_reset", userId: user.id, targetId: userId });
    if (userId === user.id) await reopenSession(target.email, password);
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Nouveau mot de passe enregistré pour « ${target.name} » ; ses sessions sont fermées. Communiquez-le par un canal sûr, ou préférez « Envoyer un lien ».`,
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
