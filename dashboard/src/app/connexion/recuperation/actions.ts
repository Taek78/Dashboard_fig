"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import {
  consumeToken,
  createToken,
  findActiveToken,
  recordTokenAttempt,
} from "@/data/auth-tokens";
import {
  checkQuota,
  clearLoginAttempts,
  recordQuotaUse,
} from "@/data/login-attempts";
import { trySendMail } from "@/data/mail";
import { findPasswordProblem } from "@/data/passwords";
import { logSecurity } from "@/data/security-log";
import { findUserByEmail, listUsers, setPassword } from "@/data/users";
import {
  adminPasswordRecoveredMail,
  adminRecoveryLockedMail,
  passwordRecoveredMail,
  recoveryCodeMail,
} from "@/domain/auth/mails";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import { activeAdmins } from "@/domain/auth/rules";
import {
  recoveryRequestSchema,
  recoveryVerifySchema,
} from "@/domain/auth/schemas";
import {
  AUTH_TOKEN_RULES,
  isTokenUsable,
  tokenExpiresAt,
} from "@/domain/auth/tokens";
import { PASSWORD_MIN_LENGTH, RECOVERY_CODE_LENGTH } from "@/domain/auth/types";
import type { ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/app-url";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { clientIpFrom, formatRetryDelay } from "@/lib/rate-limit";
import {
  generateLinkToken,
  generateRecoveryCode,
  hashSecret,
  secretsMatch,
} from "@/lib/secrets";

/*
 * « Mot de passe oublié », en deux actions publiques (pas de session).
 *
 * requestRecoveryCode : zod → quota (e-mail et IP, table login_attempts) →
 * si un compte ACTIF porte l'adresse : code à 6 chiffres (HMAC en base, 5 min,
 * 5 essais) et lien « Ce n'était pas moi » (24 h), mail envoyé APRÈS la
 * réponse (after) ; sinon un HMAC factice pour un coût voisin. Dans les deux
 * cas la même redirection vers l'étape 2 : la page ne dit jamais si l'adresse
 * existe. Journal : recovery_requested (e-mail, IP, compte ou null).
 *
 * verifyRecoveryCode : zod → compte et dernier code actif → comparaison des
 * HMAC en temps constant ; un code faux compte un essai, le cinquième annule
 * le code et alerte les administrateurs ; un code juste applique la politique
 * de mots de passe (règles pures puis fuites connues), consomme le code (une
 * seule fois, même en parallèle), enregistre le mot de passe (ce qui ferme les
 * autres sessions), efface le verrou de connexion, prévient la personne et les
 * administrateurs, puis ouvre la session. Message d'échec unique pour un code
 * faux, expiré ou absent.
 */
const MESSAGES = {
  invalidEmail: "Saisissez une adresse e-mail valide.",
  throttled: (delay: string) => `Trop de demandes. Réessayez dans ${delay}.`,
  invalidVerify: `Vérifiez le code (${RECOVERY_CODE_LENGTH} chiffres) et le nouveau mot de passe : ${PASSWORD_MIN_LENGTH} caractères au moins, saisi deux fois à l'identique.`,
  wrongCode: "Code incorrect ou expiré. Demandez un nouveau code.",
  codeLocked:
    "Trop de codes erronés : ce code est annulé. Demandez un nouveau code.",
  changed: "Mot de passe modifié. Connectez-vous avec le nouveau.",
  failure: "Impossible de traiter la demande. Réessayez dans un instant.",
} as const;

async function issueLockLink(
  userId: string,
  ip: string,
  now: number,
): Promise<string> {
  const token = generateLinkToken();
  await createToken({
    kind: "lock_link",
    userId,
    secretHash: hashSecret(token, getEnv().AUTH_SECRET),
    expiresAt: tokenExpiresAt("lock_link", now),
    requestedIp: ip,
  });
  return appUrl(`/connexion/verrouiller?jeton=${token}`);
}

export async function requestRecoveryCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recoveryRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalidEmail };
  }
  const { email } = parsed.data;
  const ip = clientIpFrom(await headers());
  const now = Date.now();

  try {
    const decision = await checkQuota("recovery", email, ip, now);
    if (!decision.allowed) {
      logSecurity({
        type: "recovery_throttled",
        email,
        ip,
        retryAfterMs: decision.retryAfterMs,
      });
      return {
        status: "error",
        message: MESSAGES.throttled(formatRetryDelay(decision.retryAfterMs)),
      };
    }
    await recordQuotaUse("recovery", email, ip, now);

    const user = await findUserByEmail(email);
    const key = getEnv().AUTH_SECRET;
    if (user) {
      const code = generateRecoveryCode();
      await createToken({
        kind: "recovery_code",
        userId: user.id,
        secretHash: hashSecret(code, key),
        expiresAt: tokenExpiresAt("recovery_code", now),
        requestedIp: ip,
      });
      const lockUrl = await issueLockLink(user.id, ip, now);
      const mail = recoveryCodeMail({
        to: { email: user.email, name: user.name },
        code,
        lockUrl,
      });
      after(() => trySendMail("recovery_code", mail));
    } else {
      hashSecret(generateRecoveryCode(), key);
    }
    logSecurity({
      type: "recovery_requested",
      email,
      ip,
      userId: user?.id ?? null,
    });
  } catch (error) {
    console.error("[requestRecoveryCode]", error);
    return { status: "error", message: MESSAGES.failure };
  }

  redirect(
    `/connexion/recuperation?etape=code&email=${encodeURIComponent(email)}`,
  );
}

export async function verifyRecoveryCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recoveryVerifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalidVerify };
  }
  const { email, code, newPassword } = parsed.data;
  const ip = clientIpFrom(await headers());
  const now = Date.now();

  try {
    const user = await findUserByEmail(email);
    const token = user ? await findActiveToken("recovery_code", user.id) : null;
    if (!user || !token || !isTokenUsable(token, now)) {
      return { status: "error", message: MESSAGES.wrongCode };
    }

    const key = getEnv().AUTH_SECRET;
    if (!secretsMatch(hashSecret(code, key), token.secretHash)) {
      const attempts = await recordTokenAttempt(token.id);
      logSecurity({ type: "recovery_failed", userId: user.id, ip, attempts });
      const max = AUTH_TOKEN_RULES.recovery_code.maxAttempts ?? Infinity;
      if (attempts >= max) {
        await consumeToken(token.id, new Date(now));
        logSecurity({ type: "recovery_locked", userId: user.id, ip });
        const admins = activeAdmins(await listUsers());
        after(() =>
          Promise.all(
            admins.map((admin) =>
              trySendMail(
                "admin_recovery_locked",
                adminRecoveryLockedMail({
                  to: { email: admin.email, name: admin.name },
                  account: { name: user.name, email: user.email },
                  ip,
                }),
              ),
            ),
          ),
        );
        return { status: "error", message: MESSAGES.codeLocked };
      }
      return { status: "error", message: MESSAGES.wrongCode };
    }

    const problem = await findPasswordProblem(newPassword, {
      email: user.email,
      name: user.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }

    if (!(await consumeToken(token.id, new Date(now)))) {
      return { status: "error", message: MESSAGES.wrongCode };
    }
    const changedAt = new Date(now);
    await setPassword(user.id, await hashPassword(newPassword), changedAt);
    await clearLoginAttempts({ email, ip });
    logSecurity({ type: "password_recovered", userId: user.id, ip });

    const lockUrl = await issueLockLink(user.id, ip, now);
    const admins = activeAdmins(await listUsers());
    const at = changedAt.toISOString();
    after(async () => {
      await trySendMail(
        "password_recovered",
        passwordRecoveredMail({
          to: { email: user.email, name: user.name },
          at,
          ip,
          lockUrl,
        }),
      );
      await Promise.all(
        admins.map((admin) =>
          trySendMail(
            "admin_password_recovered",
            adminPasswordRecoveredMail({
              to: { email: admin.email, name: admin.name },
              account: { name: user.name, email: user.email },
              at,
              ip,
            }),
          ),
        ),
      );
    });
  } catch (error) {
    console.error("[verifyRecoveryCode]", error);
    return { status: "error", message: MESSAGES.failure };
  }

  try {
    await signIn("credentials", {
      email,
      password: newPassword,
      redirectTo: "/",
    });
    return { status: "success", message: MESSAGES.changed };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "success", message: MESSAGES.changed };
    }
    throw error;
  }
}
