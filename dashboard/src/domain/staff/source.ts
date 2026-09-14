import type { StaffKind } from "@/domain/staff/kind";
import type { StaffInput, StaffMember } from "@/domain/staff/types";

/*
 * CONTRAT du personnel : fixtures (src/data/staff.mock.ts) ou Drizzle
 * (src/data/staff.db.ts). Types seulement.
 * - listStaff(kind) renvoie toute l'équipe ou un métier, triée (staff/rules.ts) ;
 * - createStaff attribue l'id et createdAt ; updateStaff et deleteStaff
 *   renvoient null / false si la personne n'existe pas ;
 * - createStaff et updateStaff renvoient "email_taken" si l'e-mail est déjà
 *   pris par une autre personne (sans casse).
 */
export type StaffSource = {
  listStaff(kind?: StaffKind): Promise<StaffMember[]>;
  getStaff(id: string): Promise<StaffMember | null>;
  createStaff(input: StaffInput): Promise<StaffMember | "email_taken">;
  updateStaff(
    id: string,
    input: StaffInput,
  ): Promise<StaffMember | "email_taken" | null>;
  deleteStaff(id: string): Promise<boolean>;
};
