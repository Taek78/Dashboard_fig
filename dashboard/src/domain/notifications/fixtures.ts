import { scenarioCustomers } from "@/domain/customers/scenario";
import { orderStatusNotification } from "@/domain/notifications/rules";
import type { CustomerNotification } from "@/domain/notifications/types";
import { orderEventsFixtures, scenarioOrders } from "@/domain/orders/fixtures";

/*
 * File de notifications factice : ce que le dashboard AURAIT déposé pour les
 * commandes du scénario, c'est-à-dire une notification par changement de
 * statut (orderEventsFixtures) des clients qui ont autorisé les notifications
 * d'état. Celles de la veille sont « envoyées » par l'application deux minutes
 * après le dépôt ; celles du jour du scénario attendent encore. Déterministe,
 * relu dans les fixtures voisines : rien n'est écrit en dur.
 */
const SENT_BEFORE = "2026-09-07T00:00:00.000Z";
const SEND_DELAY_MS = 2 * 60 * 1000;

const consenting = new Set(
  scenarioCustomers.filter((c) => c.consents.orderStatus).map((c) => c.id),
);

export const notificationsFixtures: readonly CustomerNotification[] =
  scenarioOrders
    .filter((order) => consenting.has(order.customer.id))
    .flatMap((order) =>
      orderEventsFixtures
        .filter((event) => event.orderId === order.id)
        .map((event, i): CustomerNotification => {
          const draft = orderStatusNotification(
            order,
            event.to,
            event.cancellation,
          );
          return {
            id: `ntf-${order.id}-${i + 1}`,
            customerId: order.customer.id,
            order: { id: order.id, reference: order.reference },
            kind: "order_status",
            orderStatus: event.to,
            title: draft.title,
            body: draft.body,
            createdAt: event.at,
            sentAt:
              event.at < SENT_BEFORE
                ? new Date(Date.parse(event.at) + SEND_DELAY_MS).toISOString()
                : null,
            failedAt: null,
            failureReason: null,
          };
        }),
    );
