import type { Message, MessageAttachment } from "@/domain/messages/types";
import { scenarioCustomers } from "@/domain/customers/scenario";
import { scenarioOrders } from "@/domain/orders/scenario";

/*
 * Messages factices de la boîte de réception, déterministes et sans personne
 * réelle : les auteurs sont les clients du scénario (scenario.ts), les
 * commandes associées sont leurs vraies commandes. Rien n'est écrit en dur qui
 * pourrait diverger des autres fixtures : le nom, l'e-mail et la référence sont
 * RELUS dans les fixtures voisines, et une incohérence lève au chargement
 * plutôt que de produire un seed silencieusement faux.
 *
 * Les pièces jointes sont de VRAIS petits fichiers hébergés comme en
 * production (2026-09-18) : deux images PNG unies et un PDF d'une page vide,
 * écrits ici en base64. Leur taille est celle de leurs octets (la base le
 * vérifie) et leur format est celui de leur signature : le seed passe par les
 * mêmes gardes qu'un téléversement réel.
 */
function customerOf(id: string): Message["customer"] {
  const customer = scenarioCustomers.find((c) => c.id === id);
  if (!customer) throw new Error(`Fixture message : client ${id} introuvable`);
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
  };
}

/** Première commande du client dans le scénario, pour le contexte d'un message. */
function firstOrderOf(customerId: string): Message["order"] {
  const order = scenarioOrders.find((o) => o.customer.id === customerId);
  if (!order) {
    throw new Error(`Fixture message : aucune commande pour ${customerId}`);
  }
  return {
    id: order.id,
    reference: order.reference,
    createdAt: order.createdAt,
    status: order.status,
    deliverySlot: order.deliverySlot,
    deliveryAddressLine: order.deliveryAddressLine,
    deliveryCity: order.deliveryCity,
    deliveryPostalCode: order.deliveryPostalCode,
    community: order.community,
    preparer: order.preparer,
    driver: order.driver,
  };
}

/* Deux images PNG 64 × 48 unies (rouge fraise, brun carton) et un PDF d'une page vide. */
const RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAARElEQVR42u3PQQkAAAgEsItjCOMbzAp+hcEKLFP9WgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEroEFOy7gxNbYcboAAAAASUVORK5CYII=";
const BROWN_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAARElEQVR42u3PQQkAAAgEsMtkHJMY3wp+hcEKLNP1WgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEroEF2NwwtcDDpIUAAAAASUVORK5CYII=";
const BLANK_PDF =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDEwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==";

/** Un fichier téléversé du seed : ses métadonnées et ses octets en base64. */
export type MessageUploadFixture = {
  id: string;
  customerId: string;
  fileName: string;
  contentType: MessageAttachment["contentType"];
  base64: string;
};

export const messageUploadsFixtures: readonly MessageUploadFixture[] = [
  {
    id: "upl-0001",
    customerId: "cli-0001",
    fileName: "fraises-abimees.png",
    contentType: "image/png",
    base64: RED_PNG,
  },
  {
    id: "upl-0002",
    customerId: "cli-0001",
    fileName: "sac-livraison.png",
    contentType: "image/png",
    base64: BROWN_PNG,
  },
  {
    id: "upl-0003",
    customerId: "cli-0002",
    fileName: "bon-de-livraison.pdf",
    contentType: "application/pdf",
    base64: BLANK_PDF,
  },
];

/** Octets décodés d'un fichier du seed. */
export function uploadFixtureBytes(upload: MessageUploadFixture): Uint8Array {
  return Uint8Array.from(atob(upload.base64), (c) => c.charCodeAt(0));
}

/** La pièce jointe `n` (att-000n), faite du fichier upl-000n. */
function attached(n: number): MessageAttachment {
  const uploadId = `upl-${String(n).padStart(4, "0")}`;
  const upload = messageUploadsFixtures.find((u) => u.id === uploadId);
  if (!upload)
    throw new Error(`Fixture message : fichier ${uploadId} introuvable`);
  return {
    id: `att-${String(n).padStart(4, "0")}`,
    fileName: upload.fileName,
    contentType: upload.contentType,
    sizeBytes: uploadFixtureBytes(upload).length,
    uploadId,
    url: null,
  };
}

export const messagesFixtures: readonly Message[] = [
  {
    id: "msg-0001",
    customer: customerOf("cli-0001"),
    subject: "missing_or_damaged",
    body: "Bonjour,\n\nLa barquette de fraises de ma commande de mardi était écrasée, le jus avait coulé dans le sac.\nJe vous mets deux photos. Le reste du panier était parfait.\n\nMerci d'avance,\nAmel",
    order: firstOrderOf("cli-0001"),
    attachments: [attached(1), attached(2)],
    status: "untreated",
    receivedAt: "2026-09-08T07:42:00.000Z",
    pinnedAt: "2026-09-08T08:10:00.000Z",
    important: true,
    handledAt: null,
    handledByName: null,
  },
  {
    id: "msg-0002",
    customer: customerOf("cli-0004"),
    subject: "delivery_issue",
    body: "Personne n'est passé jeudi entre 10 h et 11 h alors que j'étais chez moi.\nJ'ai attendu toute la matinée. Est-ce que la tournée a été décalée ?",
    order: firstOrderOf("cli-0004"),
    attachments: [],
    status: "untreated",
    receivedAt: "2026-09-08T16:05:00.000Z",
    pinnedAt: null,
    important: true,
    handledAt: null,
    handledByName: null,
  },
  {
    id: "msg-0003",
    customer: customerOf("cli-0002"),
    subject: "order_error",
    body: "Bonjour, j'ai reçu des courgettes à la place des aubergines.\nCe n'est pas grave mais je préfère vous le signaler pour la prochaine fois.",
    order: firstOrderOf("cli-0002"),
    attachments: [attached(3)],
    status: "treated",
    receivedAt: "2026-09-07T10:18:00.000Z",
    pinnedAt: null,
    important: false,
    handledAt: "2026-09-07T14:02:00.000Z",
    handledByName: "Équipe FIG",
  },
  {
    id: "msg-0004",
    customer: customerOf("cli-0003"),
    subject: "product_question",
    body: "Est-ce que vos pommes Chantecler sont traitées après récolte ?\nMon fils est allergique et je préfère vérifier avant de commander.",
    order: null,
    attachments: [],
    status: "untreated",
    receivedAt: "2026-09-06T19:30:00.000Z",
    pinnedAt: null,
    important: false,
    handledAt: null,
    handledByName: null,
  },
  {
    id: "msg-0005",
    customer: customerOf("cli-0005"),
    subject: "refund",
    body: "Bonjour,\nSuite à l'annulation de ma commande, je n'ai toujours pas vu le remboursement sur mon compte.\nPouvez-vous me dire sous quel délai il arrive ? Un avoir me conviendrait aussi.",
    order: firstOrderOf("cli-0005"),
    attachments: [],
    status: "treated",
    receivedAt: "2026-09-05T08:55:00.000Z",
    pinnedAt: null,
    important: false,
    handledAt: "2026-09-05T11:20:00.000Z",
    handledByName: "Équipe FIG",
  },
  {
    id: "msg-0006",
    customer: customerOf("cli-0002"),
    subject: "other",
    body: "Juste un mot pour vous dire que le passage au créneau du soir est parfait pour moi.\nContinuez comme ça !",
    order: null,
    attachments: [],
    status: "treated",
    receivedAt: "2026-09-03T17:12:00.000Z",
    pinnedAt: null,
    important: false,
    handledAt: "2026-09-04T09:00:00.000Z",
    handledByName: "Équipe FIG",
  },
  {
    id: "msg-0007",
    customer: customerOf("cli-0001"),
    subject: "delivery_issue",
    body: "Le code d'entrée a changé dans mon immeuble : c'est désormais le B4512.\nJe l'ai mis à jour dans mon profil mais je préfère vous prévenir aussi.",
    order: null,
    attachments: [],
    status: "untreated",
    receivedAt: "2026-09-02T12:40:00.000Z",
    pinnedAt: null,
    important: false,
    handledAt: null,
    handledByName: null,
  },
];
