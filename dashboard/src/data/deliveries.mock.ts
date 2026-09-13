import {
  assignmentsFixtures,
  couriersFixtures,
} from "@/domain/deliveries/fixtures";
import type { DeliveriesSource } from "@/domain/deliveries/source";
import type { Assignment } from "@/domain/deliveries/types";

/*
 * Implémentation FIXTURES du contrat DeliveriesSource. Même patron que
 * orders.mock.ts : Map mutable seedée au chargement, clone à l'entrée et à la
 * sortie, latence simulée, resetDeliveriesMock() hors contrat pour les tests.
 * Seul src/data/deliveries.ts a le droit de l'importer (plus les tests).
 */
const assignments = new Map<string, Assignment>();

function seed(): void {
  assignments.clear();
  for (const a of assignmentsFixtures) {
    assignments.set(a.orderId, structuredClone(a));
  }
}

seed();

export const DELIVERIES_MOCK_LATENCY_MS = 300;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const deliveriesMock: DeliveriesSource = {
  getCouriers: async () => {
    await sleep(DELIVERIES_MOCK_LATENCY_MS);
    return structuredClone([...couriersFixtures]);
  },

  getAssignments: async (date?: string) => {
    await sleep(DELIVERIES_MOCK_LATENCY_MS);
    const all = [...assignments.values()];
    const filtered =
      date === undefined ? all : all.filter((a) => a.date === date);
    return structuredClone(filtered);
  },

  assignOrder: async (assignment: Assignment) => {
    await sleep(DELIVERIES_MOCK_LATENCY_MS);
    assignments.set(assignment.orderId, structuredClone(assignment));
    return structuredClone(assignment);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement. */
export function resetDeliveriesMock(): void {
  seed();
}
