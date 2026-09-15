import "server-only";
import { staffDb } from "@/data/staff.db";
import type { StaffSource } from "@/domain/staff/source";

/*
 * FAÇADE du personnel : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (staff.db.ts) ; la façade fixe le contrat
 * StaffSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
}: StaffSource = staffDb;
