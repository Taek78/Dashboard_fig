import {
  DELIVERY_TIMEOUT_MS,
  type CustomerNotification,
  type DeliveryState,
} from "@/domain/notifications/types";

/*
 * Règles pures de l'ENVOI d'une notification (demande du 2026-09-18), à part
 * du texte (rules.ts) : le composant client qui suit l'envoi les importe sans
 * embarquer le reste du domaine. Testées dans
 * test/domain/notifications/delivery.test.ts.
 */

/** L'état d'envoi d'une notification : envoyée, en échec, sinon en attente. */
export function deliveryState(
  notification: Pick<CustomerNotification, "sentAt" | "failedAt">,
): DeliveryState {
  if (notification.sentAt !== null) return "sent";
  return notification.failedAt !== null ? "failed" : "pending";
}

/**
 * Ce que l'écran affiche après `waitedMs` d'attente : une notification encore
 * en attente passé DELIVERY_TIMEOUT_MS est annoncée en échec (l'application
 * n'a rien accusé : réseau, serveur arrêté…), avec « Réessayer ».
 */
export function shownDelivery(
  state: DeliveryState,
  waitedMs: number,
): DeliveryState {
  return state === "pending" && waitedMs >= DELIVERY_TIMEOUT_MS
    ? "failed"
    : state;
}
