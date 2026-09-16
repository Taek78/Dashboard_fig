import type { CommunityRef } from "@/domain/communities/types";
import type { Customer } from "@/domain/customers/types";
import {
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/domain/messages/subject";
import type { Message } from "@/domain/messages/types";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { OrderDiscount } from "@/domain/orders/discount";
import { sortOrdersBySlot } from "@/domain/orders/rules";
import type { OrderStatus } from "@/domain/orders/status";
import type { Order, OrderEvent } from "@/domain/orders/types";
import { toIso } from "@/lib/days";

/*
 * Export des données d'un client (RGPD, article 15 droit d'accès, article 20
 * portabilité) : un fichier JSON complet, structuré et lisible, que
 * l'administrateur transmet à la personne qui en fait la demande.
 *
 * Contenu : la fiche, les notes internes (la personne a le droit d'en avoir
 * connaissance), toutes ses commandes avec lignes, remises, annulations et
 * historique des statuts, et tous ses messages « Nous contacter » avec la liste
 * de leurs pièces jointes.
 * Exclu volontairement : les noms des membres de l'équipe (préparateur,
 * livreur, auteur d'une note, d'un changement de statut ou du traitement d'un
 * message), données personnelles d'autres personnes (article 15.4) ; les
 * identifiants techniques des produits, sans intérêt pour elle ; et les marques
 * d'organisation interne de la boîte de réception (épingle, « important »), qui
 * disent comment l'équipe range son travail et non ce qu'elle sait de la
 * personne. Seul l'état « demande traitée » est repris : il la concerne.
 */
export const CUSTOMER_EXPORT_FORMAT = "fig-donnees-client/1";

export type CustomerDataExport = {
  format: typeof CUSTOMER_EXPORT_FORMAT;
  /** ISO 8601 */
  exportedAt: string;
  units: { amounts: string; quantities: string; dates: string };
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    postalCode: string;
    createdAt: string;
    community: CommunityRef | null;
    anonymizedAt: string | null;
  };
  internalNotes: { text: string; createdAt: string }[];
  messages: {
    subject: MessageSubject;
    /** Libellé français de l'objet : l'export doit se lire sans le code. */
    subjectLabel: string;
    body: string;
    receivedAt: string;
    /** Référence de la commande que la personne avait jointe, sinon null. */
    orderReference: string | null;
    /** Demande traitée par l'équipe. */
    handled: boolean;
    attachments: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      url: string;
    }[];
  }[];
  orders: {
    reference: string;
    createdAt: string;
    status: OrderStatus;
    deliverySlot: { date: string; start: string; end: string };
    deliveryCity: string;
    deliveryPostalCode: string;
    lines: {
      productName: string;
      quantity: number;
      unit: "piece" | "g";
      lineTotalCents: number;
    }[];
    discount: OrderDiscount | null;
    totalCents: number;
    cancellation: Cancellation | null;
    pickupCommunity: CommunityRef | null;
    statusHistory: {
      from: OrderStatus;
      to: OrderStatus;
      at: string;
      cancellation: Cancellation | null;
    }[];
  }[];
};

/**
 * Assemble l'export. Défensif : ne garde que les commandes de ce client et les
 * événements de ces commandes, quoi que la source ait passé. Commandes par
 * créneau croissant, historique par date croissante.
 */
export function buildCustomerExport(
  customer: Customer,
  orders: readonly Order[],
  events: readonly OrderEvent[],
  messages: readonly Message[],
  exportedAt: Date,
): CustomerDataExport {
  const own = sortOrdersBySlot(
    orders.filter((order) => order.customer.id === customer.id),
  );
  const history = new Map<string, OrderEvent[]>();
  for (const event of events) {
    const list = history.get(event.orderId) ?? [];
    list.push(event);
    history.set(event.orderId, list);
  }

  return {
    format: CUSTOMER_EXPORT_FORMAT,
    exportedAt: exportedAt.toISOString(),
    units: {
      amounts: "centimes d'euro (1990 = 19,90 €)",
      quantities: "grammes (unit « g ») ou pièces (unit « piece »)",
      dates: "ISO 8601 ; jours AAAA-MM-JJ, heures HH:mm (Europe/Paris)",
    },
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      postalCode: customer.postalCode,
      createdAt: customer.createdAt,
      community: customer.community,
      anonymizedAt: customer.anonymizedAt,
    },
    internalNotes: customer.notes.map((note) => ({
      text: note.text,
      createdAt: note.createdAt,
    })),
    messages: messages
      .filter((message) => message.customer.id === customer.id)
      .toSorted((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      .map((message) => ({
        subject: message.subject,
        subjectLabel: MESSAGE_SUBJECT_LABELS[message.subject],
        body: message.body,
        receivedAt: message.receivedAt,
        orderReference: message.order?.reference ?? null,
        handled: message.status === "treated",
        attachments: message.attachments.map((file) => ({
          fileName: file.fileName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          url: file.url,
        })),
      })),
    orders: own.map((order) => ({
      reference: order.reference,
      createdAt: order.createdAt,
      status: order.status,
      deliverySlot: order.deliverySlot,
      deliveryCity: order.deliveryCity,
      deliveryPostalCode: order.deliveryPostalCode,
      lines: order.lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        unit: line.unit,
        lineTotalCents: line.lineTotalCents,
      })),
      discount: order.discount,
      totalCents: order.totalCents,
      cancellation: order.cancellation,
      pickupCommunity: order.community,
      statusHistory: (history.get(order.id) ?? [])
        .toSorted((a, b) => a.at.localeCompare(b.at))
        .map((event) => ({
          from: event.from,
          to: event.to,
          at: event.at,
          cancellation: event.cancellation,
        })),
    })),
  };
}

/**
 * Nom du fichier téléchargé. L'identifiant vient de l'URL : tout caractère
 * hors lettres, chiffres, tiret et souligné est remplacé, pour qu'il ne puisse
 * jamais casser l'en-tête Content-Disposition.
 */
export function customerExportFileName(
  customerId: string,
  exportedAt: Date,
): string {
  const safe = customerId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `fig-client-${safe}-${toIso(exportedAt)}.json`;
}
