"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { consumeToken, findTokenByHash } from "@/data/auth-tokens";
import { clearLoginAttempts } from "@/data/login-attempts";
import { trySendMail } from "@/data/mail";
import { findPasswordProblem } from "@/data/passwords";
import { logSecurity } from "@/data/security-log";
import { findUserById, listUsers, setPassword } from "@/data/users";
import {
  accountActivatedMail,
  adminAccountActivatedMail,
} from "@/domain/auth/mails";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import { activeAdmins } from "@/domain/auth/rules";
import { invitationSchema } from "@/domain/auth/schemas";
import { isTokenUsable } from "@/domain/auth/tokens";
import { PASSWORD_MIN_LENGTH } from "@/domain/auth/types";
import type { ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/app-url";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { clientIpFrom } from "@/lib/rate-limit";
import { hashSecret } from "@/lib/secrets";

/*
 * Lien d'invitation (page publique) : la personne choisit son mot de passe.
 * zod → jeton retrouvé par son HMAC, utilisable (48 h, non consommé), compte
 * actif → politique de mots de passe (règles pures puis fuites connues) →
 * consommation du jeton (une seule fois) → mot de passe enregistré → journal →
 * session ouverte. Un lien inconnu, expiré ou déjà utilisé reçoit le même
 * message. Premier mot de passe d'un compte invité = son ACTIVATION : après la
 * réponse, un avis part à la personne (tout ce qu'il faut pour se connecter,
 * l'administrateur à contacter) et à chaque administrateur actif ; un lien
 * « Envoyer un lien » sur un compte déjà activé ne change que le mot de passe.
 */
const MESSAGES = {
  invalid: `Vérifiez le mot de passe : ${PASSWORD_MIN_LENGTH} caractères au moins, saisi deux fois à l'identique.`,
  expired:
    "Ce lien n'est plus valable. Demandez un nouveau lien à votre administrateur.",
  done: "Mot de passe enregistré. Connectez-vous.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

export async function acceptInvitation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { token: secret, newPassword } = parsed.data;
  const ip = clientIpFrom(await headers());
  const now = Date.now();
  let email = "";

  try {
    const token = await findTokenByHash(
      "invitation",
      hashSecret(secret, getEnv().AUTH_SECRET),
    );
    if (!token || !isTokenUsable(token, now)) {
      return { status: "error", message: MESSAGES.expired };
    }
    const user = await findUserById(token.userId);
    if (!user || !user.active) {
      return { status: "error", message: MESSAGES.expired };
    }
    const problem = await findPasswordProblem(newPassword, {
      email: user.email,
      name: user.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }
    if (!(await consumeToken(token.id, new Date(now)))) {
      return { status: "error", message: MESSAGES.expired };
    }
    const activating = user.passwordHash === null;
    await setPassword(user.id, await hashPassword(newPassword), new Date(now));
    await clearLoginAttempts({ email: user.email, ip });
    logSecurity({ type: "invitation_accepted", userId: user.id, ip });
    email = user.email;

    if (activating) {
      const admins = activeAdmins(await listUsers()).map((a) => ({
        name: a.name,
        email: a.email,
      }));
      const at = new Date(now).toISOString();
      const account = { name: user.name, email: user.email, role: user.role };
      const loginUrl = appUrl("/connexion");
      const comptesUrl = appUrl("/comptes");
      after(async () => {
        await trySendMail(
          "account_activated",
          accountActivatedMail({
            to: { email: user.email, name: user.name },
            at,
            role: user.role,
            loginUrl,
            admins,
            byAdmin: false,
          }),
        );
        await Promise.all(
          admins.map((admin) =>
            trySendMail(
              "admin_account_activated",
              adminAccountActivatedMail({
                to: admin,
                account,
                at,
                comptesUrl,
                by: null,
              }),
            ),
          ),
        );
      });
    }
  } catch (error) {
    console.error("[acceptInvitation]", error);
    return { status: "error", message: MESSAGES.failure };
  }

  try {
    await signIn("credentials", {
      email,
      password: newPassword,
      redirectTo: "/",
    });
    return { status: "success", message: MESSAGES.done };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "success", message: MESSAGES.done };
    }
    throw error;
  }
}
