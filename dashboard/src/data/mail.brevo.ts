import "server-only";
import type { MailMessage } from "@/domain/mail/types";

/*
 * Transport Brevo : l'API HTTP transactionnelle (POST /v3/smtp/email), appelée
 * avec fetch, sans dépendance. Société française, données dans l'Union
 * européenne, une seule clé d'API à poser (MAIL_API_KEY) et une adresse
 * d'expédition validée chez Brevo (MAIL_FROM). Texte brut seulement. Le corps
 * de la réponse n'est jamais journalisé : seulement le code HTTP.
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
  const response = await fetchImpl(ENDPOINT, {
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
  if (!response.ok) {
    throw new Error(`Brevo a répondu ${response.status}.`);
  }
}
