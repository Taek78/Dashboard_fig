"use server";

import { revalidatePath } from "next/cache";
import { addNote, getCustomer } from "@/data/customers";
import { anonymizeCustomer } from "@/data/privacy";
import { getCurrentUser } from "@/data/session";
import {
  canAddCustomerNote,
  canHandlePrivacyRequest,
} from "@/domain/auth/roles";
import { addNoteSchema } from "@/domain/customers/schemas";
import {
  ANONYMIZE_CONFIRM_WORD,
  isAnonymized,
} from "@/domain/privacy/anonymization";
import { anonymizeCustomerSchema } from "@/domain/privacy/schemas";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/data/security-log";

/*
 * Server Actions de la fiche client.
 * - addCustomerNote : l'auteur et la date viennent du serveur (session,
 *   horloge), jamais du formulaire ; texte borné par zod ; refusée sur un
 *   client anonymisé.
 * - anonymizeCustomerData : droit à l'effacement (RGPD), administrateur seul,
 *   mot ANONYMISER exigé par zod ; l'écriture conditionnelle tient lieu de
 *   relecture (déjà anonymisé, commande encore en préparation ou expédiée,
 *   client inconnu : l'identité n'est pas réécrite) ; journal sans aucune
 *   donnée de la personne, seulement son identifiant.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour ajouter une note.",
  invalid: "La note doit contenir entre 1 et 500 caractères.",
  notFound: "Ce client n'existe plus.",
  anonymized: "Ce client est anonymisé : aucune note ne peut lui être ajoutée.",
  failure: "Impossible d'enregistrer la note. Réessayez dans un instant.",
} as const;

const ANONYMIZE_MESSAGES = {
  forbidden: "Seul un administrateur peut anonymiser un client.",
  invalid: `Tapez ${ANONYMIZE_CONFIRM_WORD} pour confirmer l'anonymisation.`,
  notFound: "Ce client n'existe plus.",
  already: "Ce client est déjà anonymisé.",
  openOrders:
    "Ce client a encore une commande en préparation ou expédiée : anonymisez-le une fois ses commandes livrées ou annulées.",
  failure: "Impossible d'anonymiser ce client. Réessayez dans un instant.",
  success:
    "Client anonymisé : identité, coordonnées et notes effacées, commandes conservées.",
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
    if (isAnonymized(customer)) {
      return { status: "error", message: MESSAGES.anonymized };
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

export async function anonymizeCustomerData(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canHandlePrivacyRequest(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "anonymizeCustomerData",
    });
    return { status: "error", message: ANONYMIZE_MESSAGES.forbidden };
  }

  const parsed = anonymizeCustomerSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { status: "error", message: ANONYMIZE_MESSAGES.invalid };
  }
  const { customerId } = parsed.data;

  try {
    const outcome = await anonymizeCustomer(customerId, new Date());
    if (outcome === "not_found") {
      return { status: "error", message: ANONYMIZE_MESSAGES.notFound };
    }
    if (outcome === "already_anonymized") {
      return { status: "error", message: ANONYMIZE_MESSAGES.already };
    }
    if (outcome === "open_orders") {
      return { status: "error", message: ANONYMIZE_MESSAGES.openOrders };
    }
    logSecurity({ type: "customer_anonymized", userId: user.id, customerId });
    // Le nom apparaît partout (commandes, tournées, tableau de bord).
    revalidatePath("/", "layout");
    return { status: "success", message: ANONYMIZE_MESSAGES.success };
  } catch (error) {
    console.error(
      "[anonymizeCustomerData]",
      { userId: user.id, customerId },
      error,
    );
    return { status: "error", message: ANONYMIZE_MESSAGES.failure };
  }
}
