"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/data/products";
import { getCurrentUser } from "@/data/session";
import { canEditProduct } from "@/domain/auth/roles";
import {
  deleteProductSchema,
  productInputSchema,
  updateProductSchema,
} from "@/domain/products/schemas";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/data/security-log";

/*
 * Server Actions du catalogue : créer, modifier, supprimer. Même discipline que
 * partout : session → rôle → zod → relecture → écriture → revalidation. Une
 * création ou une suppression réussie REDIRIGE (redirect() lève : rien après).
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour modifier le catalogue.",
  invalid:
    "Vérifiez la saisie : nom, prix en euros (ex. 3,50), nombres entiers, calibre min ≤ max.",
  notFound: "Ce produit n'existe plus.",
  confirm: "Tapez SUPPRIMER pour confirmer la suppression.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

export async function saveProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditProduct(user.role)) {
    logSecurity({ type: "forbidden", userId: user.id, action: "saveProduct" });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const raw = Object.fromEntries(formData);
  const id = updateProductSchema.safeParse(raw);
  const input = productInputSchema.safeParse(raw);
  if (!id.success || !input.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  try {
    const product = await getProduct(id.data.productId);
    if (!product) return { status: "error", message: MESSAGES.notFound };
    const updated = await updateProduct(product.id, input.data);
    if (!updated) return { status: "error", message: MESSAGES.notFound };
    revalidatePath("/catalogue", "layout");
    return {
      status: "success",
      message: `Fiche « ${updated.name} » enregistrée.`,
    };
  } catch (error) {
    console.error(
      "[saveProduct]",
      { userId: user.id, productId: id.data.productId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function addProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditProduct(user.role)) {
    logSecurity({ type: "forbidden", userId: user.id, action: "addProduct" });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const input = productInputSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) {
    return { status: "error", message: MESSAGES.invalid };
  }

  let createdId: string;
  try {
    const created = await createProduct(input.data);
    createdId = created.id;
    revalidatePath("/catalogue", "layout");
  } catch (error) {
    console.error("[addProduct]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
  redirect(`/catalogue/${createdId}?cree=1`);
}

export async function removeProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canEditProduct(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "removeProduct",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = deleteProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.confirm };
  }

  try {
    const deleted = await deleteProduct(parsed.data.productId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "product_deleted",
      userId: user.id,
      productId: parsed.data.productId,
    });
    revalidatePath("/catalogue", "layout");
  } catch (error) {
    console.error(
      "[removeProduct]",
      { userId: user.id, productId: parsed.data.productId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
  redirect("/catalogue?supprime=1");
}
