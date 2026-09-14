/*
 * Journal de sécurité : une ligne JSON par événement sur la sortie standard,
 * à collecter par l'hébergeur (et en table security_events en mode db). Le type union liste
 * ce qui peut être écrit : jamais de mot de passe, de jeton ni de corps de
 * formulaire, seulement des identifiants et des adresses. formatSecurityEvent
 * est pur et testé ; l'écriture (sortie standard et table security_events)
 * vit dans src/data/security-log.ts.
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
  | { type: "article_deleted"; userId: string; articleId: string }
  | { type: "account_created"; userId: string; targetId: string; role: string }
  | { type: "account_updated"; userId: string; targetId: string; role: string }
  | { type: "account_deactivated"; userId: string; targetId: string }
  | { type: "account_reactivated"; userId: string; targetId: string }
  | { type: "password_reset"; userId: string; targetId: string }
  | { type: "password_changed"; userId: string };

export function formatSecurityEvent(event: SecurityEvent, now: Date): string {
  return JSON.stringify({ ts: now.toISOString(), kind: "security", ...event });
}
