"use server";

import { revalidatePath } from "next/cache";
import { addNote, getCustomer } from "@/data/customers";
import { getCurrentUser } from "@/data/session";
import { canAddCustomerNote } from "@/domain/auth/roles";
import { addNoteSchema } from "@/domain/customers/schemas";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/data/security-log";

/*
 * Server Action d'ajout d'une note interne. L'auteur et la date viennent du
 * serveur (session, horloge), jamais du formulaire. Le texte est borné par zod.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour ajouter une note.",
  invalid: "La note doit contenir entre 1 et 500 caractères.",
  notFound: "Ce client n'existe plus.",
  failure: "Impossible d'enregistrer la note. Réessayez dans un instant.",
} as const;

export async function addCustomerNote(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canAddCustomerNote(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "addCustomerNote",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = addNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const { customerId, text } = parsed.data;

  try {
    const customer = await getCustomer(customerId);
    if (!customer) {
      return { status: "error", message: MESSAGES.notFound };
    }

    const created = await addNote(customer.id, {
      text,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    });
    if (!created) {
      return { status: "error", message: MESSAGES.notFound };
    }

    revalidatePath("/clients", "layout");
    return { status: "success", message: "Note ajoutée." };
  } catch (error) {
    console.error("[addCustomerNote]", { userId: user.id, customerId }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
