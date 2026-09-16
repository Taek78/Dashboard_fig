import type { OrderStatus } from "@/domain/orders/status";

/*
 * Notifications déposées POUR le client (décision du client, 2026-09-16) : à
 * chaque changement de statut d'une commande fait par l'équipe, si la personne
 * a autorisé les notifications d'état (CustomerConsents.orderStatus), le
 * dashboard écrit une ligne dans la file customer_notifications. Il n'a aucun
 * canal vers le téléphone du client : c'est l'application FIG qui lit la file,
 * envoie par son propre canal et pose `sentAt` (question 23 du backlog).
 * L'enum Postgres notification_kind reprend NOTIFICATION_KINDS.
 */
export const NOTIFICATION_KINDS = ["order_status"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Le texte à déposer, composé par une règle pure (rules.ts). */
export type NotificationDraft = { title: string; body: string };

export type CustomerNotification = {
  id: string;
  customerId: string;
  order: { id: string; reference: string };
  kind: NotificationKind;
  /** Statut annoncé au client. */
  orderStatus: OrderStatus;
  title: string;
  body: string;
  /** ISO 8601 : dépôt par le dashboard. */
  createdAt: string;
  /** ISO 8601 : envoi par l'application, sinon null (en attente). */
  sentAt: string | null;
};
