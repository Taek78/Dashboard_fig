import "server-only";
import {
  mailFailureOfNetworkError,
  mailFailureOfStatus,
} from "@/domain/mail/failure";
import type { MailMessage } from "@/domain/mail/types";
import { MailSendError } from "@/lib/mail-error";

/*
 * Transport Brevo : l'API HTTP transactionnelle (POST /v3/smtp/email), appelée
 * avec fetch, sans dépendance. Société française, données dans l'Union
 * européenne, une seule clé d'API à poser (MAIL_API_KEY) et une adresse
 * d'expédition validée chez Brevo (MAIL_FROM). Texte brut seulement. Le corps
 * de la réponse n'est jamais journalisé : seulement le code HTTP.
 *
 * Un échec lève une MailSendError qui porte sa CAUSE (règle pure
 * mailFailureOfStatus) : l'écran Comptes en fait une phrase française et un
 * geste à faire, au lieu d'un « envoi impossible » muet.
 */
const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

export type BrevoConfig = {
  apiKey: string;
  from: { email: string; name: string };
};

export async function sendWithBrevo(
  message: MailMessage,
  config: BrevoConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: config.from,
        to: [
          message.to.name
            ? { email: message.to.email, name: message.to.name }
            : { email: message.to.email },
        ],
        subject: message.subject,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // Délai dépassé, DNS, connexion refusée : le fournisseur n'a rien répondu.
    const name = error instanceof Error ? error.name : "";
    throw new MailSendError(
      mailFailureOfNetworkError(name),
      `Brevo injoignable (${name || "erreur réseau"}).`,
    );
  }
  if (!response.ok) {
    throw new MailSendError(
      mailFailureOfStatus(response.status),
      `Brevo a répondu ${response.status}.`,
    );
  }
}
