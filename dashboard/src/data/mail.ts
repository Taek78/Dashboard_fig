import "server-only";
import path from "node:path";
import { sendWithBrevo } from "@/data/mail.brevo";
import { sendToFile } from "@/data/mail.file";
import { logSecurity } from "@/data/security-log";
import type { MailSender } from "@/domain/mail/source";
import type { MailMessage } from "@/domain/mail/types";
import { getEnv } from "@/lib/env";
import { mailTransportOf } from "@/lib/env-schema";

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
      throw new Error(
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

export async function trySendMail(
  kind: string,
  message: MailMessage,
): Promise<boolean> {
  try {
    await sendMail(message);
    return true;
  } catch (error) {
    console.error("[mail] envoi impossible", { kind }, error);
    logSecurity({ type: "mail_failed", kind });
    return false;
  }
}
