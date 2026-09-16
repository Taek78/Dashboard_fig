import "server-only";
import { asc, eq } from "drizzle-orm";
import { getCustomer } from "@/data/customers";
import { getCustomerMessages } from "@/data/messages";
import { getOrders } from "@/data/orders";
import { getDb } from "@/db/client";
import { toOrderEvent } from "@/db/mappers";
import { anonymizeCustomerRows } from "@/db/privacy";
import { orderEvents, orders } from "@/db/schema";
import type { PrivacySource } from "@/domain/privacy/source";

/*
 * Implémentation PostgreSQL du contrat PrivacySource. L'export relit la fiche,
 * les commandes et les messages « Nous contacter » par leurs façades (mêmes
 * mappers que les écrans) et tout l'historique des statuts du client en UNE
 * requête ; l'anonymisation est l'écriture partagée avec le script de purge
 * (src/db/privacy.ts).
 */
export const privacyDb: PrivacySource = {
  getCustomerExportData: async (customerId: string) => {
    const customer = await getCustomer(customerId);
    if (!customer) return null;
    const [customerOrders, rows, messages] = await Promise.all([
      getOrders({ customerId }),
      getDb()
        .select({ event: orderEvents })
        .from(orderEvents)
        .innerJoin(orders, eq(orderEvents.orderId, orders.id))
        .where(eq(orders.customerId, customerId))
        .orderBy(asc(orderEvents.at), asc(orderEvents.id)),
      getCustomerMessages(customerId),
    ]);
    return {
      customer,
      orders: customerOrders,
      events: rows.map((r) => toOrderEvent(r.event)),
      messages,
    };
  },

  anonymizeCustomer: (customerId: string, at: Date) =>
    anonymizeCustomerRows(getDb(), customerId, at),
};
