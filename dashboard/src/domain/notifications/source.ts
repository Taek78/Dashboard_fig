import type {
  CustomerNotification,
  NotificationDelivery,
} from "@/domain/notifications/types";
import type { KeysetPage, KeysetResult } from "@/lib/api/cursor";

/*
 * CONTRAT de la file de notifications, implémenté par PostgreSQL
 * (src/data/notifications.db.ts). Le DÉPÔT se fait dans updateOrderStatus
 * (src/data/orders.db.ts), dans la transaction du changement de statut, pour
 * qu'un statut écrit sans sa notification, ou l'inverse, soit impossible.
 * - getOrderNotifications : celles d'une commande, de la plus récente à la plus
 *   ancienne (fiche commande) ;
 * - getCustomerNotifications : toutes celles d'une personne, de la plus
 *   ancienne à la plus récente (export RGPD, jamais paginé) ;
 * API de l'application (2026-09-17) :
 * - listCustomerNotificationsPage : « mes notifications », les plus récentes
 *   d'abord, par curseur (index composite) ;
 * - listPendingNotifications : la file à envoyer, dans l'ordre de dépôt
 *   (index partiel), lue par le serveur de l'application avec la clé de service ;
 * - markNotificationSent : pose `sent_at` UNE fois (écriture conditionnelle) :
 *   « sent », « already_sent » ou « not_found » ; il efface un échec
 *   déclaré plus tôt (l'application a réussi en réessayant d'elle-même).
 * Suivi de l'envoi (2026-09-18) :
 * - getNotificationDelivery : l'état d'une notification (en attente, envoyée,
 *   en échec), relu par l'écran qui vient de la déposer ;
 * - markNotificationFailed : l'application déclare un échec (`failed_at`,
 *   cause) ; la notification sort de la file ; une seule fois, jamais après
 *   un envoi ;
 * - requeueNotification : « Réessayer » du back-office, qui efface l'échec et
 *   la remet dans la file (sans effet si elle y est déjà).
 */
export type MarkSentOutcome = "sent" | "already_sent" | "not_found";
export type MarkFailedOutcome =
  "failed" | "already_sent" | "already_failed" | "not_found";
export type RequeueOutcome = "queued" | "already_sent" | "not_found";

export type NotificationsSource = {
  getOrderNotifications(orderId: string): Promise<CustomerNotification[]>;
  getCustomerNotifications(customerId: string): Promise<CustomerNotification[]>;
  listCustomerNotificationsPage(
    customerId: string,
    page: KeysetPage,
  ): Promise<KeysetResult<CustomerNotification>>;
  listPendingNotifications(limit: number): Promise<CustomerNotification[]>;
  markNotificationSent(id: string, at: Date): Promise<MarkSentOutcome>;
  getNotificationDelivery(id: string): Promise<NotificationDelivery | null>;
  markNotificationFailed(
    id: string,
    at: Date,
    reason: string | null,
  ): Promise<MarkFailedOutcome>;
  requeueNotification(id: string): Promise<RequeueOutcome>;
};
