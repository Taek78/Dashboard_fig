import { staffFixtures } from "@/domain/staff/fixtures";
import type { StaffKind } from "@/domain/staff/kind";
import { filterStaff, sortStaff } from "@/domain/staff/rules";
import type { StaffSource } from "@/domain/staff/source";
import type { StaffInput, StaffMember } from "@/domain/staff/types";

/*
 * Implémentation FIXTURES du contrat StaffSource : Map mutable seedée, clone à
 * l'entrée et à la sortie, latence simulée, resetStaffMock() hors contrat.
 * createdAt reçoit une valeur fixe (déterminisme sous Vitest) ; les ids créés
 * sont un compteur local ("stf-m-1"…), la vraie base en générera.
 */
const store = new Map<string, StaffMember>();
let counter = 0;

function seed(): void {
  store.clear();
  counter = 0;
  for (const m of staffFixtures) store.set(m.id, structuredClone(m));
}

seed();

export const STAFF_MOCK_LATENCY_MS = 300;
export const MOCK_STAFF_CREATED_AT = "2026-09-14T08:00:00.000Z";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function emailTaken(email: string, exceptId?: string): boolean {
  const wanted = email.trim().toLowerCase();
  for (const m of store.values()) {
    if (m.id !== exceptId && m.email.toLowerCase() === wanted) return true;
  }
  return false;
}

export const staffMock: StaffSource = {
  listStaff: async (kind?: StaffKind) => {
    await sleep(STAFF_MOCK_LATENCY_MS);
    return structuredClone(sortStaff(filterStaff([...store.values()], kind)));
  },

  getStaff: async (id: string) => {
    await sleep(STAFF_MOCK_LATENCY_MS);
    const member = store.get(id);
    return member ? structuredClone(member) : null;
  },

  createStaff: async (input: StaffInput) => {
    await sleep(STAFF_MOCK_LATENCY_MS);
    if (emailTaken(input.email)) return "email_taken";
    counter += 1;
    const created: StaffMember = {
      ...structuredClone(input),
      id: `stf-m-${counter}`,
      createdAt: MOCK_STAFF_CREATED_AT,
    };
    store.set(created.id, created);
    return structuredClone(created);
  },

  updateStaff: async (id: string, input: StaffInput) => {
    await sleep(STAFF_MOCK_LATENCY_MS);
    const current = store.get(id);
    if (!current) return null;
    if (emailTaken(input.email, id)) return "email_taken";
    const updated: StaffMember = {
      ...structuredClone(input),
      id: current.id,
      createdAt: current.createdAt,
    };
    store.set(id, updated);
    return structuredClone(updated);
  },

  deleteStaff: async (id: string) => {
    await sleep(STAFF_MOCK_LATENCY_MS);
    return store.delete(id);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement. */
export function resetStaffMock(): void {
  seed();
}
