"use server";

import { revalidatePath } from "next/cache";
import { assignOrder, getAssignments, getCouriers } from "@/data/deliveries";
import { getOrder } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canAssignCourier } from "@/domain/auth/roles";
import { canBeAssigned, hasSlotConflict } from "@/domain/deliveries/rules";
import { assignCourierSchema } from "@/domain/deliveries/schemas";
import { ORDER_STATUS_LABELS } from "@/domain/orders/status";
import type { ActionResult } from "@/lib/action-result";

/*
 * Server Action d'attribution d'un livreur (A3). Même discipline que
 * changeOrderStatus : session → rôle → zod → relecture (commande, livreurs,
 * attributions du jour) → règles pures → écriture → revalidation → résultat.
 * Le créneau vient de la commande RELUE, jamais du formulaire.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour attribuer un livreur.",
  invalid: "La demande d'attribution n'est pas valide.",
  orderNotFound: "Cette commande n'existe plus.",
  courierNotFound: "Ce livreur n'existe pas.",
  conflict: "Ce livreur a déjà une livraison sur ce créneau.",
  failure: "Impossible d'enregistrer l'attribution. Réessayez dans un instant.",
} as const;

export async function assignCourier(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canAssignCourier(user.role)) {
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = assignCourierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const { orderId, courierId } = parsed.data;

  try {
    const order = await getOrder(orderId);
    if (!order) {
      return { status: "error", message: MESSAGES.orderNotFound };
    }
    if (!canBeAssigned(order.status)) {
      return {
        status: "error",
        message: `Une commande « ${ORDER_STATUS_LABELS[order.status]} » ne peut pas être attribuée.`,
      };
    }

    const couriers = await getCouriers();
    const courier = couriers.find((c) => c.id === courierId);
    if (!courier) {
      return { status: "error", message: MESSAGES.courierNotFound };
    }

    const assignments = await getAssignments(order.deliverySlot.date);
    const conflict = hasSlotConflict(
      assignments,
      courier.id,
      order.deliverySlot,
      order.id,
    );
    if (conflict) {
      return { status: "error", message: MESSAGES.conflict };
    }

    await assignOrder({
      orderId: order.id,
      courierId: courier.id,
      date: order.deliverySlot.date,
      start: order.deliverySlot.start,
      end: order.deliverySlot.end,
    });

    revalidatePath("/livraisons");
    revalidatePath("/commandes", "layout");
    return {
      status: "success",
      message: `${courier.name} livrera la commande ${order.reference}.`,
    };
  } catch (error) {
    console.error("[assignCourier]", { userId: user.id, orderId }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
