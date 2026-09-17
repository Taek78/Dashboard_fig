import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MailMessage } from "@/domain/mail/types";

/*
 * Transport « fichier » : chaque mail devient un fichier JSON dans un dossier
 * (MAIL_FILE_DIR, sinon dashboard/.mail, ignoré par git). Sert au
 * développement (on ouvre le fichier pour lire le code) et à la suite
 * navigateur (Playwright y lit le code et les liens). Jamais en production
 * sans le dire explicitement : la garde d'environnement exige MAIL_TRANSPORT.
 */
export type StoredMail = MailMessage & { at: string };

export async function sendToFile(
  message: MailMessage,
  dir: string,
  now: Date = new Date(),
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `${stamp}-${randomUUID().slice(0, 8)}.json`);
  const stored: StoredMail = { ...message, at: now.toISOString() };
  await writeFile(path, JSON.stringify(stored, null, 2), "utf8");
  return path;
}
