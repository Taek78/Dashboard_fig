"use server";

import { revalidatePath } from "next/cache";
import {
  assignStaff,
  getOrder,
  setOrderRefund,
  updateOrderStatus,
} from "@/data/orders";
import {
  getNotificationDelivery,
  requeueNotification,
} from "@/data/notifications";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import {
  canAssignStaff,
  canChangeOrderStatus,
  canRecordRefund,
} from "@/domain/auth/roles";
import { orderStatusNotification } from "@/domain/notifications/rules";
import { requeueNotificationSchema } from "@/domain/notifications/schemas";
import { ASSIGNMENT_ROLE_LABELS } from "@/domain/orders/assignment";
import { formatCancellation } from "@/domain/orders/cancellation";
import {
  acceptsRefund,
  isRefundAmountValid,
  REFUND_KIND_LABELS,
} from "@/domain/orders/refund";
import {
  assignStaffSchema,
  changeStatusSchema,
  refundInputSchema,
} from "@/domain/orders/schemas";
import {
  canTransition,
  isFinished,
  ORDER_STATUS_LABELS,
} from "@/domain/orders/status";
import { canBeAssigned, staffFullName } from "@/domain/staff/rules";
import type { ActionResult } from "@/lib/action-result";
import { formatEuros } from "@/lib/format";

/**
 * Résultat du changement de statut : la confirmation, et si le client a été
 * notifié (case cochée ET autorisation relue sur la commande) ; absent quand
 * rien n'a été écrit (refus, statut déjà en place).
 */
export type StatusChangeResult = ActionResult & {
  notified?: boolean;
  /** La notification déposée, dont l'écran suit l'envoi ; absente sinon. */
  notificationId?: string;
};
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
  refunded:
    "Cette commande a été remboursée ou a reçu un avoir : elle reste annulée. Retirez d'abord le remboursement.",
  conflict: "Cette commande a changé entre-temps, la page a été actualisée.",
  failure: "Impossible d'enregistrer le changement. Réessayez dans un instant.",
} as const;

export async function changeOrderStatus(
  _prev: StatusChangeResult,
  formData: FormData,
): Promise<StatusChangeResult> {
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
  const { orderId, nextStatus, cancellation, notify } = parsed.data;

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
    if (order.refund) {
      return { status: "error", message: MESSAGES.refunded };
    }

    // 6. Règle métier, une seule fois, ici (depuis le 2026-09-17, tout statut
    //    différent du courant est permis ; la règle reste dans le domaine pour
    //    pouvoir être resserrée sans toucher aux écrans).
    const allowed = canTransition(order.status, nextStatus);
    if (!allowed) {
      return {
        status: "error",
        message: `Le passage de « ${ORDER_STATUS_LABELS[order.status]} » à « ${ORDER_STATUS_LABELS[nextStatus]} » n'est pas autorisé.`,
      };
    }

    // 7. Écriture conditionnelle : `from` est le statut RELU, jamais une valeur du
    //    client ; l'acteur vient de la session et entre dans l'historique. La
    //    notification pour le client est composée ici (texte figé) et déposée
    //    par la source dans la même transaction, seulement s'il l'a autorisée
    //    et si la case « Notifier le client » est restée cochée (notify).
    const updated = await updateOrderStatus(order.id, {
      from: order.status,
      to: nextStatus,
      actor: { id: user.id, name: user.name },
      cancellation,
      notification: notify
        ? orderStatusNotification(order, nextStatus, cancellation)
        : null,
    });
    if (!updated) {
      revalidatePath("/", "layout");
      return { status: "error", message: MESSAGES.conflict };
    }
    // Notifié = une notification a réellement été déposée (case cochée ET
    // autorisation relue par la base dans la transaction du statut).
    const notified = updated.notificationId !== null;

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
        ? `Commande annulée. Motif ${notified ? "communiqué au client" : "enregistré"} : ${formatCancellation(cancellation)}.`
        : `Statut mis à jour : ${ORDER_STATUS_LABELS[nextStatus]}.`,
      notified,
      ...(updated.notificationId
        ? { notificationId: updated.notificationId }
        : {}),
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
 * personne active, commande non terminée, affectation inchangée depuis
 * l'affichage) → écriture conditionnelle → journal → revalidation.
 * Le nom écrit sur la commande est celui relu en base, jamais un champ envoyé ;
 * `expectedStaffId` (la personne que l'écran montrait) ne sert que de
 * précondition : un faux ne peut qu'empêcher l'écriture.
 */
const ASSIGN_MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour affecter l'équipe.",
  invalid: "Affectation invalide.",
  notFound: "Cette commande n'existe plus.",
  staffNotFound: "Cette personne n'est plus dans l'équipe.",
  wrongKind: "Cette personne n'a pas le bon métier pour ce rôle.",
  finished: "Une commande terminée ne peut plus être affectée.",
  conflict:
    "L'affectation a été modifiée entre-temps par quelqu'un d'autre : la liste a été actualisée.",
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
  const { orderId, role, staffId, expectedStaffId } = parsed.data;

  try {
    const order = await getOrder(orderId);
    if (!order) return { status: "error", message: ASSIGN_MESSAGES.notFound };
    if (isFinished(order.status)) {
      return { status: "error", message: ASSIGN_MESSAGES.finished };
    }
    if (
      expectedStaffId !== undefined &&
      (order[role]?.id ?? null) !== expectedStaffId
    ) {
      revalidatePath("/", "layout");
      return { status: "error", message: ASSIGN_MESSAGES.conflict };
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

    // Écriture conditionnelle : rien n'est écrit si la commande a disparu, s'est
    // terminée ou a été réaffectée entre la relecture et l'écriture.
    const updated = await assignStaff(order.id, {
      role,
      staff,
      expectedStaffId,
    });
    if (!updated) {
      const latest = await getOrder(order.id);
      revalidatePath("/", "layout");
      return {
        status: "error",
        message: !latest
          ? ASSIGN_MESSAGES.notFound
          : isFinished(latest.status)
            ? ASSIGN_MESSAGES.finished
            : ASSIGN_MESSAGES.conflict,
      };
    }

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

/*
 * « Réessayer » l'envoi d'une notification en échec (demande du 2026-09-18) :
 * session → rôle (qui change un statut, c'est lui qui l'a déposée) → zod →
 * écriture conditionnelle (requeueNotification : l'échec est effacé, la
 * notification revient dans la file de l'application ; rien si elle est déjà
 * partie) → journal. L'écran relance alors son attente de l'accusé.
 */
export type RequeueResult =
  | { status: "queued" }
  | { status: "sent" }
  | { status: "error"; message: string };

export async function requeueCustomerNotification(
  notificationId: string,
): Promise<RequeueResult> {
  const user = await getCurrentUser();
  if (!canChangeOrderStatus(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "requeueCustomerNotification",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = requeueNotificationSchema.safeParse({ notificationId });
  if (!parsed.success) {
    return { status: "error", message: "Notification introuvable." };
  }
  try {
    const delivery = await getNotificationDelivery(parsed.data.notificationId);
    if (!delivery) {
      return { status: "error", message: "Notification introuvable." };
    }
    const outcome = await requeueNotification(delivery.id);
    if (outcome === "not_found") {
      return { status: "error", message: "Notification introuvable." };
    }
    if (outcome === "already_sent") return { status: "sent" };
    logSecurity({
      type: "notification_requeued",
      userId: user.id,
      notificationId: delivery.id,
      orderId: delivery.orderId,
    });
    return { status: "queued" };
  } catch (error) {
    console.error(
      "[requeueCustomerNotification]",
      { userId: user.id, notificationId },
      error,
    );
    return {
      status: "error",
      message:
        "Impossible de renvoyer la notification. Réessayez dans un instant.",
    };
  }
}

/*
 * Remboursement ou AVOIR d'une commande annulée (demande du 2026-09-19) :
 * session → rôle (admin, gestionnaire) → zod → relecture de la commande →
 * règle (annulée, montant > 0 et ≤ total RELU) → écriture conditionnelle
 * (setOrderRefund : la base revérifie statut et total) → journal →
 * revalidation. « Retirer » efface le remboursement (erreur de saisie) et
 * libère le statut.
 */
const REFUND_MESSAGES = {
  forbidden:
    "Vous n'avez pas les droits pour enregistrer un remboursement ou un avoir.",
  kind: "Choisissez « Remboursement » ou « Avoir ».",
  amount: "Indiquez un montant en euros, par exemple 12,50.",
  notFound: "Cette commande n'existe plus.",
  notCancelled:
    "Seule une commande annulée peut être remboursée ou recevoir un avoir.",
  tooMuch: "Le montant dépasse le total de la commande.",
  nothing: "Aucun remboursement à retirer.",
  conflict: "Cette commande a changé entre-temps, la page a été actualisée.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

export async function recordOrderRefund(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canRecordRefund(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "recordOrderRefund",
    });
    return { status: "error", message: REFUND_MESSAGES.forbidden };
  }
  const parsed = refundInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const onKind = parsed.error.issues.some((i) => i.path[0] === "kind");
    return {
      status: "error",
      message: onKind ? REFUND_MESSAGES.kind : REFUND_MESSAGES.amount,
    };
  }
  const { orderId, refund } = parsed.data;

  try {
    const order = await getOrder(orderId);
    if (!order) return { status: "error", message: REFUND_MESSAGES.notFound };
    if (refund === null) {
      if (!order.refund) {
        return { status: "error", message: REFUND_MESSAGES.nothing };
      }
    } else {
      if (!acceptsRefund(order)) {
        return { status: "error", message: REFUND_MESSAGES.notCancelled };
      }
      if (!isRefundAmountValid(refund.amountCents, order.totalCents)) {
        return { status: "error", message: REFUND_MESSAGES.tooMuch };
      }
    }

    const updated = await setOrderRefund(order.id, {
      refund,
      at: new Date(),
    });
    if (!updated) {
      revalidatePath("/", "layout");
      return { status: "error", message: REFUND_MESSAGES.conflict };
    }

    logSecurity(
      refund
        ? {
            type: "order_refund_recorded",
            userId: user.id,
            orderId: order.id,
            kind: refund.kind,
            amountCents: refund.amountCents,
          }
        : { type: "order_refund_removed", userId: user.id, orderId: order.id },
    );
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: refund
        ? `${REFUND_KIND_LABELS[refund.kind]} enregistré : ${formatEuros(refund.amountCents)}.`
        : "Remboursement retiré.",
    };
  } catch (error) {
    console.error("[recordOrderRefund]", { userId: user.id, orderId }, error);
    return { status: "error", message: REFUND_MESSAGES.failure };
  }
}
