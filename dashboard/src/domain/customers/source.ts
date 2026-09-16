import type {
  Customer,
  CustomerFilters,
  CustomerNote,
  CustomerReferral,
} from "@/domain/customers/types";

/*
 * CONTRAT des clients, implémenté par PostgreSQL (src/data/customers.db.ts).
 * Types seulement. addNote reçoit la note complète (id exclu) : la date vient
 * de l'action (horloge du serveur), jamais du formulaire.
 * getCustomerReferrals : les filleuls d'un client (ceux qui ont saisi son code),
 * du plus ancien au plus récent ; lus par la fiche seulement, jamais par une
 * carte.
 */
export type CustomersSource = {
  getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  getCustomerReferrals(customerId: string): Promise<CustomerReferral[]>;
  addNote(
    customerId: string,
    note: Omit<CustomerNote, "id">,
  ): Promise<CustomerNote | null>;
};
