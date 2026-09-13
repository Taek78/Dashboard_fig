import type { Customer, CustomerNote } from "@/domain/customers/types";

/*
 * CONTRAT des clients : mock aujourd'hui, Drizzle en B3. Types seulement.
 * addNote reçoit la note complète (id exclu) : la date vient de l'action, pas du
 * store, pour que le mock reste déterministe sous Vitest.
 */
export type CustomersSource = {
  getCustomers(query?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  addNote(
    customerId: string,
    note: Omit<CustomerNote, "id">,
  ): Promise<CustomerNote | null>;
};
