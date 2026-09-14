"use server";

import { revalidatePath } from "next/cache";
import { assignStaff, getOrder, updateOrderStatus } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import { ASSIGNMENT_ROLE_LABELS } from "@/domain/orders/assignment";
import { formatCancellation } from "@/domain/orders/cancellation";
import { assignStaffSchema, changeStatusSchema } from "@/domain/orders/schemas";
import { canTransition, ORDER_STATUS_LABELS } from "@/domain/orders/status";
import { canBeAssigned, staffFullName } from "@/domain/staff/rules";
import type { ActionResult } from "@/lib/action-result";
import { logSecurity } from "@/data/security-log";

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

/*
 * Affectation d'un préparateur ou d'un livreur. Même discipline : session →
 * rôle → zod → relecture de la commande ET de la personne → règle (bon métier,
 * personne active, commande non terminée) → écriture → journal → revalidation.
 * Le nom écrit sur la commande est celui relu en base, jamais un champ envoyé.
 */
const ASSIGN_MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour affecter l'équipe.",
  invalid: "Affectation invalide.",
  notFound: "Cette commande n'existe plus.",
  staffNotFound: "Cette personne n'est plus dans l'équipe.",
  wrongKind: "Cette personne n'a pas le bon métier pour ce rôle.",
  finished: "Une commande terminée ne peut plus être affectée.",
  failure: "Impossible d'enregistrer l'affectation. Réessayez dans un instant.",
} as const;

export async function assignOrderStaff(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canAssignStaff(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "assignOrderStaff",
    });
    return { status: "error", message: ASSIGN_MESSAGES.forbidden };
  }
  const parsed = assignStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: ASSIGN_MESSAGES.invalid };
  }
  const { orderId, role, staffId } = parsed.data;

  try {
    const order = await getOrder(orderId);
    if (!order) return { status: "error", message: ASSIGN_MESSAGES.notFound };
    if (order.status === "delivered" || order.status === "cancelled") {
      return { status: "error", message: ASSIGN_MESSAGES.finished };
    }

    let staff: { id: string; name: string } | null = null;
    if (staffId !== null) {
      const member = await getStaff(staffId);
      if (!member) {
        return { status: "error", message: ASSIGN_MESSAGES.staffNotFound };
      }
      if (!canBeAssigned(member, role)) {
        return { status: "error", message: ASSIGN_MESSAGES.wrongKind };
      }
      staff = { id: member.id, name: staffFullName(member) };
    }

    const updated = await assignStaff(order.id, { role, staff });
    if (!updated) return { status: "error", message: ASSIGN_MESSAGES.notFound };

    logSecurity({
      type: "order_staff_assigned",
      userId: user.id,
      orderId: order.id,
      role,
      staffId: staff?.id ?? null,
    });
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: staff
        ? `${ASSIGNMENT_ROLE_LABELS[role]} : ${staff.name}.`
        : `${ASSIGNMENT_ROLE_LABELS[role]} retiré.`,
    };
  } catch (error) {
    console.error("[assignOrderStaff]", { userId: user.id, orderId }, error);
    return { status: "error", message: ASSIGN_MESSAGES.failure };
  }
}
