import type { AttachmentContentType } from "@/domain/messages/attachment";
import type { MessageStatus } from "@/domain/messages/status";
import type { MessageSubject } from "@/domain/messages/subject";
import type { Order } from "@/domain/orders/types";

/*
 * Types métier de la boîte de réception : le vocabulaire du FRONT (les lignes
 * Postgres y sont converties par src/db/mappers.ts).
 *
 * Un message est ÉCRIT PAR LE CLIENT dans l'application FIG (« Nous
 * contacter ») : le dashboard ne le crée jamais et n'en modifie jamais le
 * contenu. Les trois seules choses que l'équipe change sont le statut,
 * l'épingle et le signalement « important ».
 *
 * Conventions : dates en chaînes ISO, tailles en octets entiers.
 */
export type MessageAttachment = {
  id: string;
  /** Nom du fichier tel que le client l'a envoyé, affiché tel quel. */
  fileName: string;
  contentType: AttachmentContentType;
  sizeBytes: number;
  /** URL de téléchargement posée par l'application FIG (question 22). */
  url: string;
};

/*
 * Ce que le message montre de la commande que le client a jointe : quand elle
 * a été passée, où et quand elle est livrée, qui la prépare et qui la livre.
 * Ni lignes ni montants : ils sont sur la fiche de la commande, en un lien.
 */
export type MessageOrder = Pick<
  Order,
  | "id"
  | "reference"
  | "createdAt"
  | "status"
  | "deliverySlot"
  | "deliveryAddressLine"
  | "deliveryCity"
  | "deliveryPostalCode"
  | "community"
  | "preparer"
  | "driver"
>;

export type Message = {
  id: string;
  /** Auteur du message. La fiche complète se relit par getCustomer(id). */
  customer: { id: string; fullName: string; email: string };
  subject: MessageSubject;
  /** Corps du message, texte brut ; les sauts de ligne sont ceux du client. */
  body: string;
  /**
   * Commande associée par le client dans l'application pour donner le
   * contexte, sinon null. Une commande supprimée ne supprime pas le message.
   */
  order: MessageOrder | null;
  /** Dix au plus (MAX_ATTACHMENTS), dans l'ordre d'envoi. */
  attachments: MessageAttachment[];
  status: MessageStatus;
  /** ISO 8601 : réception dans l'application. */
  receivedAt: string;
  /** ISO 8601 : épinglé en haut de la liste par l'équipe, sinon null. */
  pinnedAt: string | null;
  /** Signalé « important » par l'équipe. */
  important: boolean;
  /** ISO 8601 du dernier changement de statut par l'équipe, sinon null. */
  handledAt: string | null;
  /** Qui a changé le statut en dernier, sinon null. */
  handledByName: string | null;
};

/** Longueur maximale de la recherche libre (?q=) de la boîte de réception. */
export const MESSAGE_SEARCH_MAX_LENGTH = 100;

/** Valeur d'URL du filtre « signalés importants » (?important=oui). */
export const IMPORTANT_FILTER = "oui";

/** Nombre de lignes du message affichées en aperçu sur une carte. */
export const MESSAGE_PREVIEW_LINES = 2;

/*
 * Filtres de la liste, déjà validés (sortie de parseMessageFilters, jamais
 * l'URL brute). `from` / `to` bornent le JOUR DE RÉCEPTION "AAAA-MM-JJ",
 * bornes incluses. Chaque champ absent = pas de filtre sur ce critère ;
 * `important` ne vaut que `true` (« seulement les importants »), jamais
 * `false` : « pas de filtre » se dit déjà par l'absence.
 */
export type MessageFilters = {
  /** Nom du client, e-mail, corps du message ou référence de la commande liée. */
  query?: string;
  status?: MessageStatus;
  subject?: MessageSubject;
  from?: string;
  to?: string;
  important?: true;
  /** Fiche client : ses messages seulement (pas encore branché sur un écran). */
  customerId?: string;
};

/** Qui a fait le geste : l'utilisateur de la session, jamais un champ de formulaire. */
export type MessageActor = { id: string; name: string };

/*
 * Ce que l'API transmet à la source pour DÉPOSER un message écrit par la
 * personne dans l'application (2026-09-17) : objet, texte, commande jointe
 * (déjà vérifiée comme la sienne) et métadonnées des pièces jointes (dix au
 * plus, fichiers hébergés par l'application). La source attribue les
 * identifiants et l'instant de réception.
 */
export type NewMessage = {
  customerId: string;
  subject: MessageSubject;
  body: string;
  orderId: string | null;
  attachments: Omit<MessageAttachment, "id">[];
};

/*
 * Ce que la Server Action transmet à la source. Chaque changement porte l'état
 * RELU (`from`) : la source en fait une précondition d'écriture, et rien n'est
 * écrasé si quelqu'un a agi entre l'affichage et le clic.
 */
export type MessageStatusChange = {
  from: MessageStatus;
  to: MessageStatus;
  actor: MessageActor;
  /** ISO 8601, horloge du SERVEUR. */
  at: string;
};

export type MessagePinChange = {
  from: boolean;
  to: boolean;
  /** ISO 8601, horloge du serveur ; ignoré quand on désépingle. */
  at: string;
};

export type MessageImportantChange = { from: boolean; to: boolean };
