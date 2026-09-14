"use server";

import { revalidatePath } from "next/cache";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import {
  createUser,
  getUser,
  listUsers,
  setPassword,
  updateUser,
} from "@/data/users";
import { canManageUsers } from "@/domain/auth/roles";
import { wouldRemoveLastAdmin } from "@/domain/auth/rules";
import {
  createUserSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/domain/auth/schemas";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword } from "@/lib/password";

/*
 * Server Actions de la gestion des comptes, réservées à
 * l'administrateur. Même discipline : session → rôle → zod → relecture →
 * règles (jamais se désactiver soi-même, jamais retirer le dernier admin) →
 * écriture → journal → revalidation. Les mots de passe sont hachés ici et
 * n'apparaissent dans aucun message ni journal.
 */
const MESSAGES = {
  forbidden: "Seul un administrateur peut gérer les comptes.",
  invalid: `Vérifiez la saisie : e-mail valide, nom, rôle, mot de passe de ${PASSWORD_MIN_LENGTH} caractères au moins.`,
  emailTaken: "Un compte existe déjà avec cet e-mail.",
  notFound: "Ce compte n'existe plus.",
  self: "Vous ne pouvez pas désactiver votre propre compte.",
  lastAdmin:
    "Impossible : ce compte est le dernier administrateur actif du back-office.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

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
      passwordHash: await hashPassword(parsed.data.password),
    });
    if (created === "email_taken") {
      return { status: "error", message: MESSAGES.emailTaken };
    }
    logSecurity({
      type: "account_created",
      userId: user.id,
      targetId: created.id,
      role: created.role,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${created.name} » créé (${created.email}).`,
    };
  } catch (error) {
    console.error("[createAccount]", { userId: user.id }, error);
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
    if (!updated) return { status: "error", message: MESSAGES.notFound };
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
        : `Compte « ${updated.name} » désactivé : il ne peut plus se connecter.`,
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
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, password } = parsed.data;

  try {
    const target = await getUser(userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    const ok = await setPassword(userId, await hashPassword(password));
    if (!ok) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "password_reset", userId: user.id, targetId: userId });
    return {
      status: "success",
      message: `Nouveau mot de passe enregistré pour « ${target.name} ». Communiquez-le par un canal sûr.`,
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
