import "server-only";
import path from "node:path";
import { sendWithBrevo } from "@/data/mail.brevo";
import { sendToFile } from "@/data/mail.file";
import { logSecurity } from "@/data/security-log";
import type { MailSender } from "@/domain/mail/source";
import type { MailMessage, MailOutcome } from "@/domain/mail/types";
import { getEnv } from "@/lib/env";
import { mailTransportOf } from "@/lib/env-schema";
import { MailSendError, reasonOf } from "@/lib/mail-error";

/*
 * FAÇADE d'envoi de mail : le seul module que les Server Actions importent.
 * Le transport est choisi à l'appel, jamais à l'import (next build charge les
 * modules sans .env) : Brevo en production, fichier en développement et dans
 * la suite navigateur (src/lib/env-schema.ts, mailTransportOf).
 *
 * trySendMail est la forme à utiliser depuis after() : un échec d'envoi ne
 * casse jamais l'action qui l'a demandé, il est journalisé (mail_failed, avec
 * la sorte du mail, jamais l'adresse ni le contenu) et la personne peut
 * redemander ; l'administrateur garde de toute façon la main depuis Comptes.
 */
const DEFAULT_FROM_NAME = "FIG Back-office";

export const sendMail: MailSender["sendMail"] = async (
  message: MailMessage,
) => {
  const env = getEnv();
  if (mailTransportOf(env) === "brevo") {
    if (!env.MAIL_API_KEY || !env.MAIL_FROM) {
      throw new MailSendError(
        "configuration",
        "Transport brevo sans MAIL_API_KEY ou MAIL_FROM : envoi impossible.",
      );
    }
    await sendWithBrevo(message, {
      apiKey: env.MAIL_API_KEY,
      from: {
        email: env.MAIL_FROM,
        name: env.MAIL_FROM_NAME ?? DEFAULT_FROM_NAME,
      },
    });
    return;
  }
  await sendToFile(
    message,
    env.MAIL_FILE_DIR ?? path.resolve(process.cwd(), ".mail"),
  );
};

/**
 * Envoi dont on ATTEND le résultat : rend la cause de l'échec (jamais le
 * message d'erreur du fournisseur, qui n'est pas pour l'écran). À utiliser
 * quand la suite dépend de l'envoi — l'invitation, sans laquelle personne ne
 * peut entrer. Ne lève pas : l'appelant décide quoi faire de l'échec.
 */
export async function sendMailChecked(
  kind: string,
  message: MailMessage,
): Promise<MailOutcome> {
  try {
    await sendMail(message);
    return { sent: true };
  } catch (error) {
    console.error("[mail] envoi impossible", { kind }, error);
    logSecurity({ type: "mail_failed", kind });
    return { sent: false, reason: reasonOf(error) };
  }
}

export async function trySendMail(
  kind: string,
  message: MailMessage,
): Promise<boolean> {
  const outcome = await sendMailChecked(kind, message);
  return outcome.sent;
}
