import type { Customer } from "@/domain/customers/types";
import type { Message } from "@/domain/messages/types";
import type { Order, OrderEvent } from "@/domain/orders/types";
import type { AnonymizeOutcome } from "@/domain/privacy/anonymization";

/*
 * CONTRAT des demandes RGPD d'un client, implémenté par PostgreSQL
 * (src/data/privacy.db.ts). Types seulement.
 * - getCustomerExportData : tout ce que la base garde sur la personne (fiche,
 *   notes, commandes, historique des statuts, messages « Nous contacter » et
 *   leurs pièces jointes) ; borné par la personne, jamais paginé : un export au
 *   titre du droit d'accès doit être complet ;
 * - anonymizeCustomer : écriture conditionnelle (seulement si pas encore
 *   anonymisé), en une transaction ; `at` vient de l'horloge du serveur.
 */
export type CustomerExportData = {
  customer: Customer;
  orders: Order[];
  events: OrderEvent[];
  messages: Message[];
};

export type PrivacySource = {
  getCustomerExportData(customerId: string): Promise<CustomerExportData | null>;
  anonymizeCustomer(customerId: string, at: Date): Promise<AnonymizeOutcome>;
};
