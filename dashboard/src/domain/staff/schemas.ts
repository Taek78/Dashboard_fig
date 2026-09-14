import { z } from "zod";
import {
  AVAILABILITIES,
  SHIFTS,
  STAFF_KINDS,
  WEEKDAYS,
  type StaffKind,
} from "@/domain/staff/kind";
import {
  STAFF_DELETE_CONFIRM_WORD,
  STAFF_NAME_MAX_LENGTH,
  STAFF_NOTES_MAX_LENGTH,
  type StaffInput,
} from "@/domain/staff/types";

/*
 * Schémas zod des ENTRÉES du personnel : lecture tolérante (?type= de la
 * liste), écriture stricte (fiche, création, suppression). Les jours travaillés
 * arrivent en plusieurs valeurs de FormData (formData.getAll) : l'action les
 * passe en tableau, le schéma les dédoublonne et les remet dans l'ordre de la
 * semaine.
 */
export const staffIdSchema = z.string().trim().min(1).max(64);

/** ?type=livreur|preparateur|gestionnaire, sinon tout le monde. */
export function parseStaffKind(
  raw: Record<string, string | string[] | undefined>,
): StaffKind | undefined {
  return z.enum(STAFF_KINDS).optional().catch(undefined).parse(raw.type);
}

const name = z.string().trim().min(1).max(STAFF_NAME_MAX_LENGTH);
const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const staffInputSchema = z
  .object({
    kind: z.enum(STAFF_KINDS),
    firstName: name,
    lastName: name,
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[+\d][\d .]*$/, "Téléphone invalide"),
    shift: z.enum(SHIFTS),
    availability: z.enum(AVAILABILITIES),
    workDays: z.array(z.enum(WEEKDAYS)).max(14).default([]),
    startedAt: z.iso.date(),
    notes: z
      .string()
      .trim()
      .max(STAFF_NOTES_MAX_LENGTH)
      .transform((v) => (v === "" ? null : v)),
    active: checkbox,
  })
  .transform((v): StaffInput => ({
    ...v,
    workDays: WEEKDAYS.filter((d) => v.workDays.includes(d)),
  }));

export const updateStaffSchema = z.object({ staffId: staffIdSchema });

export { STAFF_DELETE_CONFIRM_WORD };
export const deleteStaffSchema = z.object({
  staffId: staffIdSchema,
  confirm: z.literal(STAFF_DELETE_CONFIRM_WORD),
});
