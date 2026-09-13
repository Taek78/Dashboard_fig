/*
 * Journal de sécurité : une ligne JSON par événement sur la sortie standard,
 * à collecter par l'hébergeur (et en base en piste B2). Le type union liste
 * ce qui peut être écrit : jamais de mot de passe, de jeton ni de corps de
 * formulaire, seulement des identifiants et des adresses. formatSecurityEvent
 * est pur et testé ; logSecurity l'écrit (silencieux sous Vitest).
 */
export type SecurityEvent =
  | { type: "login_success"; email: string; ip: string }
  | { type: "login_failure"; email: string; ip: string }
  | { type: "login_locked"; email: string; ip: string; retryAfterMs: number }
  | { type: "forbidden"; userId: string; action: string }
  | {
      type: "order_status_changed";
      userId: string;
      orderId: string;
      from: string;
      to: string;
    }
  | { type: "product_deleted"; userId: string; productId: string }
  | { type: "article_deleted"; userId: string; articleId: string };

export function formatSecurityEvent(event: SecurityEvent, now: Date): string {
  return JSON.stringify({ ts: now.toISOString(), kind: "security", ...event });
}

export function logSecurity(event: SecurityEvent): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(formatSecurityEvent(event, new Date()));
}
