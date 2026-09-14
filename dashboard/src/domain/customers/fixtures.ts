import { scenarioCustomers } from "@/domain/customers/scenario";
import type { Customer } from "@/domain/customers/types";
import { generatedCustomers } from "@/domain/orders/history";

/*
 * Tous les clients factices : les douze du scénario (scenario.ts) plus ceux de
 * l'historique généré sur deux ans (orders/history.ts). Chaque client a au
 * moins une commande dans ordersFixtures.
 */
export { scenarioCustomers } from "@/domain/customers/scenario";

export const customersFixtures: readonly Customer[] = [
  ...scenarioCustomers,
  ...generatedCustomers,
];
