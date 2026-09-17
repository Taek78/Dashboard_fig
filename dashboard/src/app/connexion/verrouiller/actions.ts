"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { consumeToken, findTokenByHash } from "@/data/auth-tokens";
import { trySendMail } from "@/data/mail";
import { logSecurity } from "@/data/security-log";
import {
  findUserById,
  listUsers,
  revokeSessions,
  updateUser,
} from "@/data/users";
import { adminAccountLockedMail } from "@/domain/auth/mails";
import { activeAdmins, wouldRemoveLastAdmin } from "@/domain/auth/rules";
import { lockAccountSchema } from "@/domain/auth/schemas";
import { AUTH_TOKEN_RULES, isTokenUsable } from "@/domain/auth/tokens";
import type { ActionResult } from "@/lib/action-result";
import { getEnv } from "@/lib/env";
import { clientIpFrom } from "@/lib/rate-limit";
import { hashSecret } from "@/lib/secrets";

/*
 * « Ce n'était pas moi » (page publique) : le titulaire d'un compte, qui a
 * reçu un mail de récupération qu'il n'a pas demandé, verrouille son compte.
 * Le lien ne vaut que 24 h et n'est connu que de sa boîte mail (un attaquant
 * qui l'aurait aurait aussi le code) ; la page l'affiche, le bouton (POST)
 * agit : un robot qui suit les liens d'un mail ne verrouille rien.
 * Effet : compte désactivé ET sessions fermées (un attaquant déjà connecté
 * est éjecté, et le reste après réactivation), jeton consommé, journal,
 * alerte aux administrateurs, qui vérifient par téléphone avant de réactiver.
 * Le dernier administrateur actif ne peut pas se verrouiller : il passe par
 * « Mot de passe oublié » pour reprendre la main.
 */
const MESSAGES = {
  expired: `Ce lien n'est plus valable (${AUTH_TOKEN_RULES.lock_link.validity}). Si vous pensez que votre compte est en danger, prévenez votre administrateur.`,
  already:
    "Ce compte est déjà verrouillé. Votre administrateur peut le réactiver.",
  lastAdmin:
    "Ce compte est le dernier administrateur actif : il ne peut pas être verrouillé. Changez plutôt son mot de passe par « Mot de passe oublié ».",
  locked:
    "Votre compte est verrouillé et ses sessions fermées. Votre administrateur est prévenu et vous contactera pour le réactiver.",
  failure: "Impossible de traiter la demande. Réessayez dans un instant.",
} as const;

export async function lockOwnAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = lockAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.expired };
  const ip = clientIpFrom(await headers());
  const now = Date.now();

  try {
    const token = await findTokenByHash(
      "lock_link",
      hashSecret(parsed.data.token, getEnv().AUTH_SECRET),
    );
    if (!token || !isTokenUsable(token, now)) {
      return { status: "error", message: MESSAGES.expired };
    }
    const user = await findUserById(token.userId);
    if (!user) return { status: "error", message: MESSAGES.expired };
    if (!user.active) return { status: "success", message: MESSAGES.already };

    const users = await listUsers();
    if (wouldRemoveLastAdmin(users, user.id, { active: false })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    if (!(await consumeToken(token.id, new Date(now)))) {
      return { status: "error", message: MESSAGES.expired };
    }
    await updateUser(user.id, { active: false });
    await revokeSessions(user.id, new Date(now));
    logSecurity({ type: "account_locked_by_owner", userId: user.id, ip });

    const admins = activeAdmins(users);
    after(() =>
      Promise.all(
        admins.map((admin) =>
          trySendMail(
            "admin_account_locked",
            adminAccountLockedMail({
              to: { email: admin.email, name: admin.name },
              account: { name: user.name, email: user.email },
              ip,
            }),
          ),
        ),
      ),
    );
    return { status: "success", message: MESSAGES.locked };
  } catch (error) {
    console.error("[lockOwnAccount]", error);
    return { status: "error", message: MESSAGES.failure };
  }
}
