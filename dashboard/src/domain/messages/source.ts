import type {
  Message,
  MessageFilters,
  MessageImportantChange,
  MessagePinChange,
  MessageStatusChange,
} from "@/domain/messages/types";
import type { Page } from "@/domain/orders/rules";

/*
 * CONTRAT de la boîte de réception, implémenté par PostgreSQL
 * (src/data/messages.db.ts). Ce fichier ne contient que des types.
 *
 * Il n'y a AUCUNE fonction de création ni de modification du contenu : les
 * messages sont écrits par l'application FIG. Le dashboard ne touche qu'aux
 * trois marques posées par l'équipe (statut, épingle, important).
 *
 * Lectures (jamais un historique entier) :
 * - getMessagesPage : une page de la liste, épinglés d'abord puis les plus
 *   récents ; filtres, recherche, comptage et découpage faits par la base.
 * - countMessages : le nombre de messages qui passent les filtres (le compteur
 *   « non traités » du menu et de l'en-tête).
 * - getMessage : un message avec ses pièces jointes et la commande associée.
 *
 * Écritures (toutes CONDITIONNELLES, comme updateOrderStatus) : chaque
 * changement porte l'état relu (`from`). `null` = rien n'a été écrit, parce que
 * le message a disparu ou que quelqu'un a agi entre l'affichage et le clic.
 */
export type MessagesSource = {
  getMessagesPage(
    filters: MessageFilters,
    page: number,
    size?: number,
  ): Promise<Page<Message>>;
  countMessages(filters: MessageFilters): Promise<number>;
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
