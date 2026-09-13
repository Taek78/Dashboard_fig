import "server-only";
import { selectSource } from "@/data/select-source";
import type { CustomersSource } from "@/domain/customers/source";
import { customersMock } from "@/data/customers.mock";

/* FAÇADE des clients : seul module importé par le front. Une ligne change en B3. */
// B1 : choix par DATA_SOURCE. La version Drizzle (B3) remplacera le null.
const source: CustomersSource = selectSource("clients", customersMock, null);

export const getCustomers: CustomersSource["getCustomers"] = (query) =>
  source.getCustomers(query);
export const getCustomer: CustomersSource["getCustomer"] = (id) =>
  source.getCustomer(id);
export const addNote: CustomersSource["addNote"] = (customerId, note) =>
  source.addNote(customerId, note);
