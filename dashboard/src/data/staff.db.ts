import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { staffToRow, toStaffMember } from "@/db/mappers";
import { staff } from "@/db/schema";
import type { StaffKind } from "@/domain/staff/kind";
import { sortStaff } from "@/domain/staff/rules";
import type { StaffSource } from "@/domain/staff/source";
import type { StaffInput } from "@/domain/staff/types";

/*
 * Implémentation Drizzle du contrat StaffSource : table `staff`, e-mail unique
 * sans casse (index sur lower(email), vérifié avant l'écriture pour renvoyer
 * "email_taken" plutôt qu'une erreur Postgres). L'équipe est petite : tri en
 * mémoire par la règle pure sortStaff.
 */
const lowerEmail = (email: string) => email.trim().toLowerCase();

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(
        eq(sql`lower(${staff.email})`, lowerEmail(email)),
        exceptId ? ne(staff.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return row !== undefined;
}

export const staffDb: StaffSource = {
  listStaff: async (kind?: StaffKind) => {
    const rows = await getDb()
      .select()
      .from(staff)
      .where(kind ? eq(staff.kind, kind) : undefined);
    return sortStaff(rows.map(toStaffMember));
  },

  getStaff: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);
    return row ? toStaffMember(row) : null;
  },

  createStaff: async (input: StaffInput) => {
    if (await emailTaken(input.email)) return "email_taken";
    const [row] = await getDb()
      .insert(staff)
      .values({ id: randomUUID(), ...staffToRow(input) })
      .returning();
    if (!row) throw new Error("Insertion de la personne sans ligne renvoyée.");
    return toStaffMember(row);
  },

  updateStaff: async (id: string, input: StaffInput) => {
    if (await emailTaken(input.email, id)) return "email_taken";
    const [row] = await getDb()
      .update(staff)
      .set(staffToRow(input))
      .where(eq(staff.id, id))
      .returning();
    return row ? toStaffMember(row) : null;
  },

  deleteStaff: async (id: string) => {
    const deleted = await getDb()
      .delete(staff)
      .where(eq(staff.id, id))
      .returning({ id: staff.id });
    return deleted.length > 0;
  },
};
