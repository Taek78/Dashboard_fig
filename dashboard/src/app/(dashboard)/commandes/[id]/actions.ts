"use server";

import { revalidatePath } from "next/cache";
import { getOrder, updateOrderStatus } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canChangeOrderStatus } from "@/domain/auth/roles";
import { formatCancellation } from "@/domain/orders/cancellation";
import { changeStatusSchema } from "@/domain/orders/schemas";
import { canTransition, ORDER_STATUS_LABELS } from "@/domain/orders/status";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/lib/security-log";

/*
 * Server Action de changement de statut : un POST public que n'importe qui peut
 * forger. Elle revérifie donc tout, dans un ordre imposé (voir a2-spec-branchements
 * §4) : session → rôle → validation zod → relecture de la commande → règle métier →
 * écriture conditionnelle → invalidation du cache → résultat.
 *
 * Elle ne fait confiance à rien de ce que le formulaire envoie : le statut courant
 * vient de getOrder(), jamais d'un champ caché. Les messages sont figés en français ;
 * aucune valeur reçue n'est reflétée telle quelle, seuls les libellés de l'enum.
 */
const MESSAGES = {
  forbidden:
    "Vous n'avez pas les droits pour modifier le statut d'une commande.",
  invalid: "Le statut choisi n'est pas valide.",
  reason:
    "Indiquez le motif d'annulation (et une précision de 100 caractères au plus pour « Autre »).",
  notFound: "Cette commande n'existe plus.",
  alreadySet: "La commande est déjà à ce statut.",
  conflict: "Cette commande a changé entre-temps, la page a été actualisée.",
  failure: "Impossible d'enregistrer le changement. Réessayez dans un instant.",
} as const;

export async function changeOrderStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // 1. Session : hors development/test le stub lève, panne visible plutôt que back-office ouvert.
  const user = await getCurrentUser();

  // 2. Rôle, avant zod : un appelant non autorisé n'obtient aucune information de validation.
  if (!canChangeOrderStatus(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "changeOrderStatus",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }

  // 3. Validation : la source ne reçoit jamais une valeur non validée.
  const parsed = changeStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.some(
      (i) => i.path[0] === "reason" || i.path[0] === "detail",
    );
    return {
      status: "error",
      message: reasonIssue ? MESSAGES.reason : MESSAGES.invalid,
    };
  }
  const { orderId, nextStatus, cancellation } = parsed.data;

  try {
    // 4. Relecture : l'état réel, pas celui que le formulaire prétend.
    const order = await getOrder(orderId);
    if (!order) {
      return { status: "error", message: MESSAGES.notFound };
    }

    // 5. Idempotence : rejouer la même demande ne fait rien.
    if (order.status === nextStatus) {
      return { status: "success", message: MESSAGES.alreadySet };
    }

    // 6. Règle métier, une seule fois, ici. Résultat stocké puis testé.
    const allowed = canTransition(order.status, nextStatus);
    if (!allowed) {
      return {
        status: "error",
        message: `Le passage de « ${ORDER_STATUS_LABELS[order.status]} » à « ${ORDER_STATUS_LABELS[nextStatus]} » n'est pas autorisé.`,
      };
    }

    // 7. Écriture conditionnelle : `from` est le statut RELU, jamais une valeur du
    //    client ; l'acteur vient de la session et entre dans l'historique.
    const updated = await updateOrderStatus(order.id, {
      from: order.status,
      to: nextStatus,
      actor: { id: user.id, name: user.name },
      cancellation,
    });
    if (!updated) {
      revalidatePath("/", "layout");
      return { status: "error", message: MESSAGES.conflict };
    }

    logSecurity({
      type: "order_status_changed",
      userId: user.id,
      orderId: order.id,
      from: order.status,
      to: nextStatus,
    });

    // 8. Un seul appel couvre tout le back-office : liste, détail, tournée, accueil, métriques.
    revalidatePath("/", "layout");

    // 9.
    return {
      status: "success",
      message: cancellation
        ? `Commande annulée. Motif communiqué au client : ${formatCancellation(cancellation)}.`
        : `Statut mis à jour : ${ORDER_STATUS_LABELS[nextStatus]}.`,
    };
  } catch (error) {
    // Côté serveur seulement, sans nom ni e-mail ; le client reçoit un message générique.
    console.error("[changeOrderStatus]", { userId: user.id, orderId }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}
