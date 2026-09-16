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
 * Les pièces jointes pointent vers des URL `https://fichiers.fig.invalid/…` :
 * un domaine réservé aux exemples, qui ne résout nulle part. Le stockage réel
 * est une question ouverte (question 22) ; ces fixtures n'en préjugent pas et
 * ne téléchargent rien.
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
  return { id: order.id, reference: order.reference };
}

function photo(
  n: number,
  fileName: string,
  sizeBytes: number,
): MessageAttachment {
  return {
    id: `att-${String(n).padStart(4, "0")}`,
    fileName,
    contentType: "image/jpeg",
    sizeBytes,
    url: `https://fichiers.fig.invalid/messages/${fileName}`,
  };
}

export const messagesFixtures: readonly Message[] = [
  {
    id: "msg-0001",
    customer: customerOf("cli-0001"),
    subject: "missing_or_damaged",
    body: "Bonjour,\n\nLa barquette de fraises de ma commande de mardi était écrasée, le jus avait coulé dans le sac.\nJe vous mets deux photos. Le reste du panier était parfait.\n\nMerci d'avance,\nAmel",
    order: firstOrderOf("cli-0001"),
    attachments: [
      photo(1, "fraises-abimees.jpg", 842_310),
      photo(2, "sac-livraison.jpg", 651_204),
    ],
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
    body: "Personne n'est passé jeudi entre 9 h et 11 h alors que j'étais chez moi.\nJ'ai attendu toute la matinée. Est-ce que la tournée a été décalée ?",
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
    attachments: [
      {
        id: "att-0003",
        fileName: "bon-de-livraison.pdf",
        contentType: "application/pdf",
        sizeBytes: 128_940,
        url: "https://fichiers.fig.invalid/messages/bon-de-livraison.pdf",
      },
    ],
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
