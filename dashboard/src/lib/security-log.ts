/*
 * Journal de sécurité : une ligne JSON par événement sur la sortie standard,
 * à collecter par l'hébergeur (et en table security_events en mode db). Le type union liste
 * ce qui peut être écrit : jamais de mot de passe, de jeton ni de corps de
 * formulaire, seulement des identifiants et des adresses. formatSecurityEvent
 * est pur et testé ; l'écriture (sortie standard et table security_events)
 * vit dans src/data/security-log.ts.
 */
import type { MailFailureReason } from "@/domain/mail/failure";

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
  | {
      type: "catalog_settings_changed";
      userId: string;
      sellWhenOutOfStock: boolean;
    }
  | {
      type: "product_duplicated";
      userId: string;
      productId: string;
      copyId: string;
    }
  | {
      type: "order_staff_assigned";
      userId: string;
      orderId: string;
      role: string;
      staffId: string | null;
    }
  | { type: "staff_created"; userId: string; staffId: string; kind: string }
  | { type: "staff_updated"; userId: string; staffId: string; kind: string }
  | { type: "staff_deleted"; userId: string; staffId: string }
  | { type: "article_deleted"; userId: string; articleId: string }
  | { type: "account_created"; userId: string; targetId: string; role: string }
  | { type: "account_updated"; userId: string; targetId: string; role: string }
  | { type: "account_deactivated"; userId: string; targetId: string }
  | { type: "account_reactivated"; userId: string; targetId: string }
  | { type: "account_deleted"; userId: string; targetId: string }
  | { type: "password_reset"; userId: string; targetId: string }
  | { type: "customer_exported"; userId: string; customerId: string }
  | { type: "customer_anonymized"; userId: string; customerId: string }
  | {
      type: "message_status_changed";
      userId: string;
      messageId: string;
      from: string;
      to: string;
    }
  | {
      type: "message_pinned";
      userId: string;
      messageId: string;
      pinned: boolean;
    }
  | {
      type: "message_flagged";
      userId: string;
      messageId: string;
      important: boolean;
    }
  | { type: "password_changed"; userId: string }
  // Récupération de compte, invitation, rappel d'adresse et verrouillage
  // (pages publiques) : l'e-mail ou l'IP saisis, jamais un code ni un jeton.
  | {
      type: "recovery_requested";
      email: string;
      ip: string;
      userId: string | null;
    }
  | {
      type: "recovery_throttled";
      email: string;
      ip: string;
      retryAfterMs: number;
    }
  | { type: "recovery_failed"; userId: string; ip: string; attempts: number }
  | { type: "recovery_locked"; userId: string; ip: string }
  | { type: "password_recovered"; userId: string; ip: string }
  | { type: "account_locked_by_owner"; userId: string; ip: string }
  | { type: "invitation_sent"; userId: string; targetId: string }
  // Le fournisseur a refusé l'envoi : la cause, jamais l'adresse ni le lien.
  | {
      type: "invitation_mail_failed";
      userId: string;
      targetId: string;
      reason: MailFailureReason;
    }
  | { type: "invitation_accepted"; userId: string; ip: string }
  | { type: "invitation_cancelled"; userId: string; targetId: string }
  // Balayage sans acteur : le compte dont le lien a expiré sans être utilisé.
  | { type: "invitation_expired"; targetId: string }
  | { type: "email_reminder_requested"; ip: string; userId: string | null }
  | { type: "mail_failed"; kind: string }
  // API de l'application FIG : l'adresse saisie ou l'IP, l'identifiant du
  // client ; jamais un code, un jeton ni un corps de requête.
  | {
      type: "api_code_requested";
      email: string;
      ip: string;
      customerId: string | null;
    }
  | {
      type: "api_code_throttled";
      email: string;
      ip: string;
      retryAfterMs: number;
    }
  | { type: "api_code_failed"; email: string; ip: string; attempts: number }
  | {
      type: "api_session_opened";
      customerId: string;
      ip: string;
      signup: boolean;
    }
  | { type: "api_session_closed"; customerId: string }
  | { type: "api_profile_updated"; customerId: string; consents: boolean }
  | {
      type: "api_community_changed";
      customerId: string;
      communityId: string | null;
    }
  | { type: "api_order_created"; customerId: string; orderId: string }
  | { type: "api_order_cancelled"; customerId: string; orderId: string }
  | { type: "api_message_created"; customerId: string; messageId: string }
  | { type: "api_notification_sent"; notificationId: string }
  | { type: "api_service_forbidden"; ip: string }
  | { type: "api_rate_limited"; subject: string; ip: string };

export function formatSecurityEvent(event: SecurityEvent, now: Date): string {
  return JSON.stringify({ ts: now.toISOString(), kind: "security", ...event });
}
