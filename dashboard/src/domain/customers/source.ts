import type {
  Customer,
  CustomerFilters,
  CustomerNote,
} from "@/domain/customers/types";

/*
 * CONTRAT des clients, implémenté par PostgreSQL (src/data/customers.db.ts).
 * Types seulement. addNote reçoit la note complète (id exclu) : la date vient
 * de l'action (horloge du serveur), jamais du formulaire.
 */
export type CustomersSource = {
  getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  addNote(
    customerId: string,
    note: Omit<CustomerNote, "id">,
  ): Promise<CustomerNote | null>;
};
