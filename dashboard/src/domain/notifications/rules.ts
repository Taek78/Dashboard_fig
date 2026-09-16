import type { NotificationDraft } from "@/domain/notifications/types";
import { formatCancellation } from "@/domain/orders/cancellation";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { OrderStatus } from "@/domain/orders/status";

/*
 * Texte des notifications d'état de commande, en français, sans jamais nommer
 * la personne : la référence et le statut suffisent (le corps est stocké en
 * base et pourrait être relu par l'équipe, minimisation RGPD). « En
 * préparation » n'est jamais annoncé : c'est l'état d'arrivée d'une commande,
 * pas un changement fait par l'équipe.
 */
const BODIES: Record<OrderStatus, (reference: string) => string> = {
  preparing: (reference) =>
    `Votre commande ${reference} est de nouveau en préparation.`,
  delivering: (reference) =>
    `Votre commande ${reference} est en route : votre livreur arrive sur le créneau choisi.`,
  delivered: (reference) =>
    `Votre commande ${reference} a été livrée. Bonne dégustation !`,
  cancelled: (reference) => `Votre commande ${reference} a été annulée.`,
};

/** Notification à déposer pour un passage au statut `to` d'une commande. */
export function orderStatusNotification(
  order: { reference: string },
  to: OrderStatus,
  cancellation: Cancellation | null = null,
): NotificationDraft {
  const body = BODIES[to](order.reference);
  return {
    title: `Commande ${order.reference}`,
    body:
      to === "cancelled" && cancellation
        ? `${body} Motif : ${formatCancellation(cancellation)}.`
        : body,
  };
}
