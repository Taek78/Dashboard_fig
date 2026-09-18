import "server-only";
import { messagesDb } from "@/data/messages.db";
import type { MessagesSource } from "@/domain/messages/source";

/*
 * FAÇADE de la boîte de réception : le seul module que le front (pages, Server
 * Actions) importe. L'implémentation est PostgreSQL (messages.db.ts) ; la
 * façade fixe le contrat MessagesSource et `server-only` (un composant client
 * qui l'importerait casse le build).
 */
export const {
  createMessage,
  listCustomerMessages,
  getMessagesPage,
  countMessages,
  countComplaints,
  getMessage,
  getCustomerMessages,
  setMessageStatus,
  setMessagePinned,
  setMessageImportant,
}: MessagesSource = messagesDb;
