import "server-only";
import { selectSource } from "@/data/select-source";
import type { CustomersSource } from "@/domain/customers/source";
import { customersDb } from "@/data/customers.db";
import { customersMock } from "@/data/customers.mock";

/* FAÇADE des clients : seul module importé par le front. Une ligne change en B3. */
const source: CustomersSource = selectSource(
  "clients",
  customersMock,
  customersDb,
);

export const getCustomers: CustomersSource["getCustomers"] = (query) =>
  source.getCustomers(query);
export const getCustomer: CustomersSource["getCustomer"] = (id) =>
  source.getCustomer(id);
export const addNote: CustomersSource["addNote"] = (customerId, note) =>
  source.addNote(customerId, note);
