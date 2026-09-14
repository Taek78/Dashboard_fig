import type {
  Customer,
  CustomerFilters,
  CustomerNote,
} from "@/domain/customers/types";

/*
 * CONTRAT des clients (fixtures ou Drizzle). Types seulement.
 * addNote reçoit la note complète (id exclu) : la date vient de l'action, pas du
 * store, pour que le mock reste déterministe sous Vitest.
 */
export type CustomersSource = {
  getCustomers(filters?: CustomerFilters): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  addNote(
    customerId: string,
    note: Omit<CustomerNote, "id">,
  ): Promise<CustomerNote | null>;
};
