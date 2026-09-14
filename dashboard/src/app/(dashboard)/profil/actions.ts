"use server";

import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { findUserById, setPassword } from "@/data/users";
import {
  changeOwnPasswordSchema,
  PASSWORD_MIN_LENGTH,
} from "@/domain/auth/schemas";
import type { ActionResult } from "@/lib/action-result";
import { hashPassword, verifyPassword } from "@/lib/password";

/*
 * Changement de son propre mot de passe, ouvert à tous les rôles :
 * session → zod (nouveau ≥ 12 caractères, confirmé, différent) → vérification
 * du mot de passe actuel contre le hachage relu → nouveau hachage → journal.
 * Un mot de passe actuel faux renvoie un message générique.
 */
const MESSAGES = {
  invalid: `Le nouveau mot de passe doit faire ${PASSWORD_MIN_LENGTH} caractères au moins, être saisi deux fois à l'identique et différer de l'actuel.`,
  wrongCurrent: "Le mot de passe actuel est incorrect.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
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
      !account ||
      !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))
    ) {
      return { status: "error", message: MESSAGES.wrongCurrent };
    }
    const ok = await setPassword(
      user.id,
      await hashPassword(parsed.data.newPassword),
    );
    if (!ok) return { status: "error", message: MESSAGES.failure };
    logSecurity({ type: "password_changed", userId: user.id });
    return { status: "success", message: "Mot de passe modifié." };
  } catch (error) {
    console.error("[changeOwnPassword]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
