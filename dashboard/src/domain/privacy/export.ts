import type { CommunityRef } from "@/domain/communities/types";
import type { CustomerConsents } from "@/domain/customers/types";
import {
  CUSTOMER_TIER_LABELS,
  customerTier,
  loyalTierEvents,
  type CustomerTier,
} from "@/domain/customers/tier";
import {
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/domain/messages/subject";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { OrderRefund } from "@/domain/orders/refund";
import type { OrderDiscount } from "@/domain/orders/discount";
import { sortOrdersBySlot } from "@/domain/orders/rules";
import type { OrderStatus } from "@/domain/orders/status";
import type { OrderEvent } from "@/domain/orders/types";
import type { CustomerExportData } from "@/domain/privacy/source";
import { toIso } from "@/lib/days";

/*
 * Export des données d'un client (RGPD, article 15 droit d'accès, article 20
 * portabilité) : un fichier JSON complet, structuré et lisible, que
 * l'administrateur transmet à la personne qui en fait la demande.
 *
 * Contenu : la fiche (adresse, autorisations et leur date, code de
 * parrainage), les notes internes (la personne a le droit d'en avoir
 * connaissance), sa catégorie et l'historique daté de ses atteintes, toutes
 * ses commandes avec lignes, remises, frais de livraison, annulations et
 * historique des statuts, tous ses messages « Nous contacter » avec la liste
 * de leurs pièces jointes, et les notifications déposées pour elle.
 * Exclu volontairement : les noms des membres de l'équipe (préparateur,
 * livreur, auteur d'une note, d'un changement de statut ou du traitement d'un
 * message), données personnelles d'autres personnes (article 15.4) ; de même
 * le NOM du parrain et ceux des filleuls : seuls « parrainé : oui/non » et le
 * nombre de filleuls sont repris ; les identifiants techniques des produits,
 * sans intérêt pour elle ; et les marques d'organisation interne de la boîte
 * de réception (épingle, « important »), qui disent comment l'équipe range
 * son travail et non ce qu'elle sait de la personne. Seul l'état « demande
 * traitée » est repris : il la concerne.
 */
/** Version 4 (2026-09-18) : pièce jointe hébergée désignée par `fileId`, `url` devenue facultative. */
export const CUSTOMER_EXPORT_FORMAT = "fig-donnees-client/5";

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
    addressLine: string | null;
    city: string;
    postalCode: string;
    createdAt: string;
    community: CommunityRef | null;
    consents: CustomerConsents;
    referralCode: string | null;
    /** La personne a été parrainée par un autre client (non nommé). */
    referred: boolean;
    /** Nombre de clients qu'elle a parrainés (non nommés). */
    referralCount: number;
    anonymizedAt: string | null;
  };
  tier: {
    current: CustomerTier;
    /** Libellé français de la catégorie : l'export doit se lire sans le code. */
    currentLabel: string;
    history: { reachedAt: string; expiresAt: string; orderReference: string }[];
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
    /**
     * Métadonnées des pièces jointes. Un fichier hébergé par le dashboard est
     * désigné par `fileId` (ses octets ne sont pas dans ce JSON : ils se
     * remettent à part, depuis la fiche du message) ; `url` ne sert qu'à une
     * pièce jointe antérieure hébergée ailleurs.
     */
    attachments: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      fileId: string | null;
      url: string | null;
    }[];
  }[];
  notifications: {
    orderReference: string;
    orderStatus: OrderStatus;
    title: string;
    body: string;
    createdAt: string;
    sentAt: string | null;
  }[];
  /** Sessions de l'application (API, format 3) : dates seulement, jamais le jeton. */
  appSessions: {
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }[];
  orders: {
    reference: string;
    createdAt: string;
    status: OrderStatus;
    deliverySlot: { date: string; start: string; end: string };
    deliveryAddressLine: string | null;
    deliveryCity: string;
    deliveryPostalCode: string;
    lines: {
      productName: string;
      quantity: number;
      unit: "piece" | "g";
      lineTotalCents: number;
    }[];
    discount: OrderDiscount | null;
    deliveryFeeCents: number;
    totalCents: number;
    cancellation: Cancellation | null;
    /** Remboursement ou avoir d'une commande annulée (format 5). */
    refund: OrderRefund | null;
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
 * Assemble l'export. Défensif : ne garde que les commandes, messages et
 * notifications de ce client et les événements de ces commandes, quoi que la
 * source ait passé. Commandes par créneau croissant, historiques par date
 * croissante. La catégorie est celle à l'instant de l'export.
 */
export function buildCustomerExport(
  data: CustomerExportData,
  exportedAt: Date,
): CustomerDataExport {
  const { customer } = data;
  const own = sortOrdersBySlot(
    data.orders.filter((order) => order.customer.id === customer.id),
  );
  const history = new Map<string, OrderEvent[]>();
  for (const event of data.events) {
    const list = history.get(event.orderId) ?? [];
    list.push(event);
    history.set(event.orderId, list);
  }
  const at = exportedAt.toISOString();
  const tier = customerTier(own, at);

  return {
    format: CUSTOMER_EXPORT_FORMAT,
    exportedAt: at,
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
      addressLine: customer.addressLine,
      city: customer.city,
      postalCode: customer.postalCode,
      createdAt: customer.createdAt,
      community: customer.community,
      consents: customer.consents,
      referralCode: customer.referralCode,
      referred: customer.referredBy !== null,
      referralCount: data.referralCount,
      anonymizedAt: customer.anonymizedAt,
    },
    tier: {
      current: tier.tier,
      currentLabel: CUSTOMER_TIER_LABELS[tier.tier],
      history: loyalTierEvents(own).map((event) => ({
        reachedAt: event.reachedAt,
        expiresAt: event.expiresAt,
        orderReference: event.orderReference,
      })),
    },
    internalNotes: customer.notes.map((note) => ({
      text: note.text,
      createdAt: note.createdAt,
    })),
    messages: data.messages
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
          fileId: file.uploadId,
          url: file.url,
        })),
      })),
    notifications: data.notifications
      .filter((n) => n.customerId === customer.id)
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((n) => ({
        orderReference: n.order.reference,
        orderStatus: n.orderStatus,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        sentAt: n.sentAt,
      })),
    appSessions: data.sessions
      .filter((s) => s.customerId === customer.id)
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((s) => ({
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
      })),
    orders: own.map((order) => ({
      reference: order.reference,
      createdAt: order.createdAt,
      status: order.status,
      deliverySlot: order.deliverySlot,
      deliveryAddressLine: order.deliveryAddressLine,
      deliveryCity: order.deliveryCity,
      deliveryPostalCode: order.deliveryPostalCode,
      lines: order.lines.map((line) => ({
        productName: line.productName,
        quantity: line.quantity,
        unit: line.unit,
        lineTotalCents: line.lineTotalCents,
      })),
      discount: order.discount,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      cancellation: order.cancellation,
      refund: order.refund,
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
