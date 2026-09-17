"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { checkQuota, recordQuotaUse } from "@/data/login-attempts";
import { trySendMail } from "@/data/mail";
import { logSecurity } from "@/data/security-log";
import { findUsersByLastName } from "@/data/users";
import { emailReminderMail } from "@/domain/auth/mails";
import { emailReminderSchema } from "@/domain/auth/schemas";
import type { ActionResult } from "@/lib/action-result";
import { clientIpFrom, formatRetryDelay } from "@/lib/rate-limit";
import { normalize } from "@/lib/text";

/*
 * « Adresse e-mail oubliée » (page publique) : la personne saisit son NOM
 * seul, tel que l'administrateur l'a enregistré (sans casse ni accent) ;
 * chaque compte actif qui porte ce nom reçoit un rappel à sa propre adresse,
 * après la réponse (deux homonymes reçoivent chacun le leur : rien ne fuit).
 * La réponse est la même dans tous les cas : la page ne dit jamais si un nom
 * existe. Quota par nom et par IP (table login_attempts). Journal :
 * email_reminder_requested par compte touché (IP, compte), ou un seul avec
 * null ; jamais le nom saisi.
 */
const MESSAGES = {
  invalid: "Saisissez votre nom (2 caractères au moins).",
  throttled: (delay: string) => `Trop de demandes. Réessayez dans ${delay}.`,
  sent: "Si un compte actif porte ce nom, un rappel vient d'être envoyé à son adresse e-mail.",
  failure: "Impossible de traiter la demande. Réessayez dans un instant.",
} as const;

export async function requestEmailReminder(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = emailReminderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { lastName } = parsed.data;
  const ip = clientIpFrom(await headers());
  const now = Date.now();

  try {
    const subject = normalize(lastName);
    const decision = await checkQuota("reminder", subject, ip, now);
    if (!decision.allowed) {
      return {
        status: "error",
        message: MESSAGES.throttled(formatRetryDelay(decision.retryAfterMs)),
      };
    }
    await recordQuotaUse("reminder", subject, ip, now);

    const matches = await findUsersByLastName(lastName);
    for (const user of matches) {
      const mail = emailReminderMail({
        to: { email: user.email, name: user.name },
      });
      after(() => trySendMail("email_reminder", mail));
      logSecurity({ type: "email_reminder_requested", ip, userId: user.id });
    }
    if (matches.length === 0) {
      logSecurity({ type: "email_reminder_requested", ip, userId: null });
    }
    return { status: "success", message: MESSAGES.sent };
  } catch (error) {
    console.error("[requestEmailReminder]", error);
    return { status: "error", message: MESSAGES.failure };
  }
}
