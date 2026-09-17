import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { E2E_MAIL_DIR } from "../playwright.config";

/*
 * Lecture des mails écrits par le serveur de test (transport « fichier »,
 * un JSON par mail dans test-results/mail). L'envoi se fait APRÈS la réponse
 * (after) : on attend le fichier quelques secondes.
 */
export type StoredMail = {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  at: string;
};

async function readAll(): Promise<StoredMail[]> {
  let names: string[];
  try {
    names = await readdir(E2E_MAIL_DIR);
  } catch {
    return [];
  }
  const mails = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(
        async (name) =>
          JSON.parse(
            await readFile(join(E2E_MAIL_DIR, name), "utf8"),
          ) as StoredMail,
      ),
  );
  return mails.toSorted((a, b) => a.at.localeCompare(b.at));
}

/** Le dernier mail reçu par `email` (sujet filtrable), écrit après `since` (ISO). */
export async function waitForMail(
  email: string,
  options: { subject?: RegExp; since?: string } = {},
  timeoutMs = 10_000,
): Promise<StoredMail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mails = (await readAll()).filter(
      (mail) =>
        mail.to.email.toLowerCase() === email.toLowerCase() &&
        (!options.subject || options.subject.test(mail.subject)) &&
        (!options.since || mail.at > options.since),
    );
    const last = mails.at(-1);
    if (last) return last;
    if (Date.now() > deadline) {
      throw new Error(
        `Aucun mail pour ${email} (${options.subject ?? "tout sujet"}).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Le code à six chiffres d'un mail de récupération. */
export function codeIn(mail: StoredMail): string {
  const match = mail.text.match(/^\s*(\d{6})\s*$/m);
  if (!match) throw new Error("Aucun code dans le mail.");
  return match[1]!;
}

/** Le premier lien du mail dont le chemin commence par `pathname`. */
export function linkIn(mail: StoredMail, pathname: string): string {
  const match = mail.text.match(new RegExp(`https?://\\S+${pathname}\\S*`));
  if (!match) throw new Error(`Aucun lien ${pathname} dans le mail.`);
  return match[0]!;
}
