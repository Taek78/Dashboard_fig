"use server";

import { findPasswordProblem } from "@/data/passwords";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser, reopenSession } from "@/data/session";
import { findUserById, setPassword } from "@/data/users";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import {
  changeOwnPasswordSchema,
  PASSWORD_MIN_LENGTH,
} from "@/domain/auth/schemas";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, verifyPassword } from "@/lib/password";

/*
 * Changement de son propre mot de passe, ouvert à tous les rôles :
 * session → zod (nouveau ≥ 12 caractères, confirmé, différent) → vérification
 * du mot de passe actuel contre le hachage relu → politique de mots de passe
 * (règles pures, puis fuites connues) → nouveau hachage → journal. Le
 * changement ferme toutes les sessions du compte ; celle-ci est rouverte avec
 * le nouveau mot de passe. Un mot de passe actuel faux renvoie un message
 * générique.
 */
const MESSAGES = {
  invalid: `Le nouveau mot de passe doit faire ${PASSWORD_MIN_LENGTH} caractères au moins, être saisi deux fois à l'identique et différer de l'actuel.`,
  wrongCurrent: "Le mot de passe actuel est incorrect.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
  done: "Mot de passe modifié. Vos autres sessions sont fermées.",
} as const;

export async function changeOwnPassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = changeOwnPasswordSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };

  try {
    const account = await findUserById(user.id);
    if (
      !account?.passwordHash ||
      !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))
    ) {
      return { status: "error", message: MESSAGES.wrongCurrent };
    }
    const problem = await findPasswordProblem(parsed.data.newPassword, {
      email: account.email,
      name: account.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }
    const ok = await setPassword(
      user.id,
      await hashPassword(parsed.data.newPassword),
      new Date(),
    );
    if (!ok) return { status: "error", message: MESSAGES.failure };
    logSecurity({ type: "password_changed", userId: user.id });
    await reopenSession(account.email, parsed.data.newPassword);
    return { status: "success", message: MESSAGES.done };
  } catch (error) {
    console.error("[changeOwnPassword]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
