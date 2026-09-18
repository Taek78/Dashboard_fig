import type {
  Message,
  MessageFilters,
  MessageImportantChange,
  MessagePinChange,
  MessageStatusChange,
  MessageUpload,
  MessageUploadFile,
  NewMessage,
  NewMessageUpload,
} from "@/domain/messages/types";
import type { Page } from "@/domain/orders/rules";
import type { KeysetPage, KeysetResult } from "@/lib/api/cursor";
import type { DateRange } from "@/lib/days";

/*
 * CONTRAT de la boîte de réception, implémenté par PostgreSQL
 * (src/data/messages.db.ts). Ce fichier ne contient que des types.
 *
 * Le dashboard ne modifie jamais le CONTENU d'un message : il ne touche qu'aux
 * trois marques posées par l'équipe (statut, épingle, important). La seule
 * création est celle de l'API, pour le compte de la personne qui écrit depuis
 * l'application (createMessage, 2026-09-17) ; listCustomerMessages est
 * « mes messages », les plus récents d'abord, par curseur (index composite).
 *
 * Lectures (jamais un historique entier) :
 * - getMessagesPage : une page de la liste, épinglés d'abord puis les plus
 *   récents ; filtres, recherche, comptage et découpage faits par la base.
 * - countMessages : le nombre de messages qui passent les filtres (le compteur
 *   « non traités » du menu et de l'en-tête).
 * - countComplaints : le nombre de réclamations reçues sur une période (les
 *   objets de CLAIM_SUBJECTS), pour la métrique « Réclamations » ; même règle
 *   que countComplaints du domaine.
 * - getMessage : un message avec ses pièces jointes et la commande associée.
 *
 * Écritures (toutes CONDITIONNELLES, comme updateOrderStatus) : chaque
 * changement porte l'état relu (`from`). `null` = rien n'a été écrit, parce que
 * le message a disparu ou que quelqu'un a agi entre l'affichage et le clic.
 */
export type MessagesSource = {
  createMessage(input: NewMessage): Promise<Message>;
  listCustomerMessages(
    customerId: string,
    page: KeysetPage,
  ): Promise<KeysetResult<Message>>;
  getMessagesPage(
    filters: MessageFilters,
    page: number,
    size?: number,
  ): Promise<Page<Message>>;
  countMessages(filters: MessageFilters): Promise<number>;
  countComplaints(range: DateRange): Promise<number>;
  getMessage(id: string): Promise<Message | null>;
  /**
   * TOUS les messages d'une personne, du plus ancien au plus récent. Borné par
   * la personne et jamais paginé : sert à l'export RGPD, qui doit être complet
   * (comme getOrders({ customerId })). Aucun écran ne l'appelle.
   */
  getCustomerMessages(customerId: string): Promise<Message[]>;
  setMessageStatus(
    id: string,
    change: MessageStatusChange,
  ): Promise<Message | null>;
  setMessagePinned(
    id: string,
    change: MessagePinChange,
  ): Promise<Message | null>;
  setMessageImportant(
    id: string,
    change: MessageImportantChange,
  ): Promise<Message | null>;
};

/*
 * CONTRAT des fichiers téléversés (2026-09-18), implémenté par
 * src/data/message-uploads.db.ts. Les octets ne sortent que par
 * getUploadFile, au service d'un fichier ; tout le reste ne voit que des
 * métadonnées. Le rattachement à un message est fait par createMessage (même
 * transaction que le message).
 */
export type MessageUploadsSource = {
  storeUpload(input: NewMessageUpload): Promise<MessageUpload>;
  /** Fichiers de la personne qui ne sont encore joints à aucun message (quota MAX_PENDING_UPLOADS). */
  countPendingUploads(customerId: string): Promise<number>;
  /** Le fichier et ses octets, sinon null ; l'appelant vérifie qui a le droit de le lire. */
  getUploadFile(id: string): Promise<MessageUploadFile | null>;
  /** Plusieurs fichiers et leurs octets en une requête, dans l'ordre demandé ; les inconnus sont omis. */
  getUploadFiles(ids: readonly string[]): Promise<MessageUploadFile[]>;
};
