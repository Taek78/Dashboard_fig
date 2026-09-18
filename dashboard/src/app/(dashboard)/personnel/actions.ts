"use server";

import { DELETE_CONFIRM_MESSAGE } from "@/lib/confirm-delete";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { createStaff, deleteStaff, getStaff, updateStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { staffFullName } from "@/domain/staff/rules";
import {
  deleteStaffSchema,
  staffInputSchema,
  updateStaffSchema,
} from "@/domain/staff/schemas";
import type { ActionResult } from "@/lib/action-result";

/*
 * Server Actions du personnel : créer, modifier, supprimer une personne de
 * l'équipe. Même discipline que partout : session → rôle → zod → relecture →
 * écriture → journal → revalidation. Les jours travaillés arrivent en
 * plusieurs valeurs (cases à cocher) : formData.getAll avant zod. Une création
 * ou une suppression réussie REDIRIGE (redirect() lève : rien après).
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour gérer le personnel.",
  invalid:
    "Vérifiez la saisie : prénom, nom, e-mail valide, téléphone, date d'entrée.",
  emailTaken: "Une personne de l'équipe a déjà cet e-mail.",
  notFound: "Cette personne n'est plus dans l'équipe.",
  confirm: DELETE_CONFIRM_MESSAGE,
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

function fields(formData: FormData): Record<string, unknown> {
  return {
    ...Object.fromEntries(formData),
    workDays: formData.getAll("workDays"),
  };
}

export async function addStaffMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageStaff(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "addStaffMember",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const input = staffInputSchema.safeParse(fields(formData));
  if (!input.success) return { status: "error", message: MESSAGES.invalid };

  let createdId: string;
  try {
    const created = await createStaff(input.data);
    if (created === "email_taken") {
      return { status: "error", message: MESSAGES.emailTaken };
    }
    createdId = created.id;
    logSecurity({
      type: "staff_created",
      userId: user.id,
      staffId: created.id,
      kind: created.kind,
    });
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("[addStaffMember]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
  redirect(`/personnel/${createdId}?cree=1`);
}

export async function saveStaffMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageStaff(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "saveStaffMember",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const raw = fields(formData);
  const id = updateStaffSchema.safeParse(raw);
  const input = staffInputSchema.safeParse(raw);
  if (!id.success || !input.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  try {
    const member = await getStaff(id.data.staffId);
    if (!member) return { status: "error", message: MESSAGES.notFound };
    const updated = await updateStaff(member.id, input.data);
    if (updated === null)
      return { status: "error", message: MESSAGES.notFound };
    if (updated === "email_taken") {
      return { status: "error", message: MESSAGES.emailTaken };
    }
    logSecurity({
      type: "staff_updated",
      userId: user.id,
      staffId: updated.id,
      kind: updated.kind,
    });
    // Le nom affecté sur les commandes est relu par jointure : toute la coquille.
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: `Fiche de ${staffFullName(updated)} enregistrée.`,
    };
  } catch (error) {
    console.error(
      "[saveStaffMember]",
      { userId: user.id, staffId: id.data.staffId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function removeStaffMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageStaff(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "removeStaffMember",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = deleteStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.confirm };

  try {
    const deleted = await deleteStaff(parsed.data.staffId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "staff_deleted",
      userId: user.id,
      staffId: parsed.data.staffId,
    });
    revalidatePath("/", "layout");
  } catch (error) {
    console.error(
      "[removeStaffMember]",
      { userId: user.id, staffId: parsed.data.staffId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
  redirect("/personnel?supprime=1");
}
