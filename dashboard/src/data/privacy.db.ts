import "server-only";
import { asc, eq } from "drizzle-orm";
import { getCustomer, getCustomerReferrals } from "@/data/customers";
import { getCustomerMessages } from "@/data/messages";
import { getCustomerNotifications } from "@/data/notifications";
import { getOrders } from "@/data/orders";
import { getDb } from "@/db/client";
import { toOrderEvent } from "@/db/mappers";
import { anonymizeCustomerRows } from "@/db/privacy";
import { orderEvents, orders } from "@/db/schema";
import type { PrivacySource } from "@/domain/privacy/source";

/*
 * Implémentation PostgreSQL du contrat PrivacySource. L'export relit la fiche,
 * les commandes, les messages « Nous contacter », les notifications déposées
 * et les filleuls par leurs façades (mêmes mappers que les écrans) et tout
 * l'historique des statuts du client en UNE requête ; l'anonymisation est
 * l'écriture partagée avec le script de purge (src/db/privacy.ts).
 */
export const privacyDb: PrivacySource = {
  getCustomerExportData: async (customerId: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) return null;
    const [customerOrders, rows, messages, notifications, referrals] =
      await Promise.all([
        getOrders({ customerId }),
        getDb()
          .select({ event: orderEvents })
          .from(orderEvents)
          .innerJoin(orders, eq(orderEvents.orderId, orders.id))
          .where(eq(orders.customerId, customerId))
          .orderBy(asc(orderEvents.at), asc(orderEvents.id)),
        getCustomerMessages(customerId),
        getCustomerNotifications(customerId),
        getCustomerReferrals(customerId),
      ]);
    return {
      customer,
      orders: customerOrders,
      events: rows.map((r) => toOrderEvent(r.event)),
      messages,
      notifications,
      referralCount: referrals.length,
    };
  },

  anonymizeCustomer: (customerId: string, at: Date) =>
    anonymizeCustomerRows(getDb(), customerId, at),
};
