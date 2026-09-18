import "server-only";
import { customersDb } from "@/data/customers.db";
import type { CustomersSource } from "@/domain/customers/source";

/*
 * FAÇADE des clients : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (customers.db.ts) ; la façade fixe le contrat
 * CustomersSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const {
  getCustomers,
  getCustomer,
  findCustomerByEmail,
  updateCustomerProfile,
  setCustomerCommunity,
  getCustomerReferrals,
  getSignupStats,
  addNote,
}: CustomersSource = customersDb;
