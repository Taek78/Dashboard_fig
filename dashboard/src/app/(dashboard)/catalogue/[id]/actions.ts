"use server";

import { revalidatePath } from "next/cache";
import { getProduct, updateProduct } from "@/data/products";
import { getCurrentUser } from "@/data/session";
import { canEditProduct } from "@/domain/auth/roles";
import { updateProductSchema } from "@/domain/products/schemas";
import type { ActionResult } from "@/lib/action-result";

/*
 * Server Action d'édition d'un produit (A4) : prix (euros → centimes par zod),
 * disponibilité, stock. Session → rôle → zod → relecture → écriture → revalidation.
 * Le prix et la quantité reçus ne sont jamais utilisés avant validation.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour modifier le catalogue.",
  invalid:
    "Saisie invalide : prix en euros (ex. 3,50) et stock en nombre entier.",
  notFound: "Ce produit n'existe plus.",
  failure: "Impossible d'enregistrer la fiche. Réessayez dans un instant.",
} as const;

export async function saveProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditProduct(user.role)) {
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = updateProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const {
    productId,
    priceEuros: priceCents,
    available,
    stockQuantity,
  } = parsed.data;

  try {
    const product = await getProduct(productId);
    if (!product) {
      return { status: "error", message: MESSAGES.notFound };
    }

    const updated = await updateProduct(product.id, {
      priceCents,
      available,
      stockQuantity,
    });
    if (!updated) {
      return { status: "error", message: MESSAGES.notFound };
    }

    revalidatePath("/catalogue", "layout");
    return {
      status: "success",
      message: `Fiche « ${updated.name} » enregistrée.`,
    };
  } catch (error) {
    console.error("[saveProduct]", { userId: user.id, productId }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
