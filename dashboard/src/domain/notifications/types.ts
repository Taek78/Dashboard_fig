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
  /** ISO 8601 : échec déclaré par l'application, sinon null (migration 0022). */
  failedAt: string | null;
  /** Cause de l'échec donnée par l'application, ou null. */
  failureReason: string | null;
};

/**
 * Où en est l'envoi d'une notification, lu par l'écran qui vient de la
 * déposer : en attente (dans la file), envoyée (accusé de l'application), en
 * échec (déclaré par l'application, ou délai d'accusé dépassé à l'écran).
 */
export const DELIVERY_STATES = ["pending", "sent", "failed"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];
export type NotificationDelivery = {
  id: string;
  orderId: string;
  state: DeliveryState;
  failureReason: string | null;
};

/** Longueur maximale de la cause d'un échec (colonne et API). */
export const FAILURE_REASON_MAX_LENGTH = 200;
/**
 * Sans accusé de l'application dans ce délai, l'écran annonce l'échec et
 * propose « Réessayer » (réseau coupé, serveur de l'application arrêté…).
 */
export const DELIVERY_TIMEOUT_MS = 90_000;
/** L'écran relit l'état de l'envoi toutes les 3 s tant qu'il attend. */
export const DELIVERY_POLL_MS = 3_000;
