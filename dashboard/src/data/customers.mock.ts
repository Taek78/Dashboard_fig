import { customersFixtures } from "@/domain/customers/fixtures";
import { filterCustomers, sortCustomersByName } from "@/domain/customers/rules";
import type { CustomersSource } from "@/domain/customers/source";
import type {
  Customer,
  CustomerFilters,
  CustomerNote,
} from "@/domain/customers/types";

/*
 * Implémentation FIXTURES du contrat CustomersSource : Map mutable seedée, clone
 * à l'entrée et à la sortie, latence simulée, resetCustomersMock() hors contrat.
 * Les ids de notes sont un compteur local ("note-m-1"…) : la vraie base en générera.
 */
const store = new Map<string, Customer>();
let noteCounter = 0;

function seed(): void {
  store.clear();
  noteCounter = 0;
  for (const c of customersFixtures) store.set(c.id, structuredClone(c));
}

seed();

export const CUSTOMERS_MOCK_LATENCY_MS = 300;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const customersMock: CustomersSource = {
  getCustomers: async (filters: CustomerFilters = {}) => {
    await sleep(CUSTOMERS_MOCK_LATENCY_MS);
    const result = sortCustomersByName(
      filterCustomers([...store.values()], filters),
    );
    return structuredClone(result);
  },

  getCustomer: async (id: string) => {
    await sleep(CUSTOMERS_MOCK_LATENCY_MS);
    const customer = store.get(id);
    return customer ? structuredClone(customer) : null;
  },

  addNote: async (customerId: string, note: Omit<CustomerNote, "id">) => {
    await sleep(CUSTOMERS_MOCK_LATENCY_MS);
    const customer = store.get(customerId);
    if (!customer) return null;
    noteCounter += 1;
    const created: CustomerNote = { id: `note-m-${noteCounter}`, ...note };
    customer.notes.push(structuredClone(created));
    return structuredClone(created);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement. */
export function resetCustomersMock(): void {
  seed();
}
