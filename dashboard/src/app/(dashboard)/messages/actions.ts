"use server";

import { revalidatePath } from "next/cache";
import {
  getMessage,
  setMessageImportant,
  setMessagePinned,
  setMessageStatus,
} from "@/data/messages";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { canHandleMessages } from "@/domain/auth/roles";
import {
  setMessageImportantSchema,
  setMessagePinnedSchema,
  setMessageStatusSchema,
} from "@/domain/messages/schemas";
import { MESSAGE_STATUS_LABELS } from "@/domain/messages/status";
import type { ActionResult } from "@/lib/action-result";

/*
 * Server Actions de la boîte de réception. Le dashboard ne touche JAMAIS au
 * contenu d'un message (écrit par le client dans l'application FIG) : ces trois
 * actions ne posent que les marques de l'équipe.
 *
 * Même discipline partout : session → rôle → zod → relecture du message →
 * idempotence → écriture conditionnelle → journal → revalidation → résultat.
 * L'état de départ passé à la source est celui RELU en base, jamais un champ
 * caché du formulaire : un bouton périmé ne peut qu'échouer, jamais écraser.
 *
 * Un message contient des données personnelles : le journal ne garde que son
 * identifiant, jamais son corps ni le nom de son auteur.
 */
const MESSAGES = {
  forbidden: "Vous n'avez pas les droits pour traiter les messages clients.",
  invalid: "Demande invalide.",
  notFound: "Ce message n'existe plus.",
  conflict:
    "Ce message a été modifié entre-temps par quelqu'un d'autre : la liste a été actualisée.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

/** Toutes les vues de la boîte (liste, fiche) dépendent de ces marques. */
function revalidateMessages(): void {
  revalidatePath("/messages", "layout");
}

export async function changeMessageStatus(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canHandleMessages(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "changeMessageStatus",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = setMessageStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const { messageId, nextStatus } = parsed.data;

  try {
    const message = await getMessage(messageId);
    if (!message) return { status: "error", message: MESSAGES.notFound };

    // Idempotence : rejouer la même demande (double clic) ne fait rien.
    if (message.status === nextStatus) {
      return {
        status: "success",
        message: `Déjà « ${MESSAGE_STATUS_LABELS[nextStatus]} ».`,
      };
    }

    const updated = await setMessageStatus(message.id, {
      from: message.status,
      to: nextStatus,
      actor: { id: user.id, name: user.name },
      at: new Date().toISOString(),
    });
    if (!updated) {
      revalidateMessages();
      return { status: "error", message: MESSAGES.conflict };
    }

    logSecurity({
      type: "message_status_changed",
      userId: user.id,
      messageId: message.id,
      from: message.status,
      to: nextStatus,
    });
    revalidateMessages();
    return {
      status: "success",
      message: `Message ${MESSAGE_STATUS_LABELS[nextStatus].toLowerCase()}.`,
    };
  } catch (error) {
    console.error(
      "[changeMessageStatus]",
      { userId: user.id, messageId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function toggleMessagePin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canHandleMessages(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "toggleMessagePin",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = setMessagePinnedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const { messageId, pinned } = parsed.data;

  try {
    const message = await getMessage(messageId);
    if (!message) return { status: "error", message: MESSAGES.notFound };

    const wasPinned = message.pinnedAt !== null;
    if (wasPinned === pinned) {
      return {
        status: "success",
        message: pinned ? "Déjà épinglé." : "Déjà désépinglé.",
      };
    }

    const updated = await setMessagePinned(message.id, {
      from: wasPinned,
      to: pinned,
      at: new Date().toISOString(),
    });
    if (!updated) {
      revalidateMessages();
      return { status: "error", message: MESSAGES.conflict };
    }

    logSecurity({
      type: "message_pinned",
      userId: user.id,
      messageId: message.id,
      pinned,
    });
    revalidateMessages();
    return {
      status: "success",
      message: pinned
        ? "Message épinglé en haut de la liste."
        : "Message désépinglé.",
    };
  } catch (error) {
    console.error("[toggleMessagePin]", { userId: user.id, messageId }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function toggleMessageImportant(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canHandleMessages(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "toggleMessageImportant",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }

  const parsed = setMessageImportantSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalid };
  }
  const { messageId, important } = parsed.data;

  try {
    const message = await getMessage(messageId);
    if (!message) return { status: "error", message: MESSAGES.notFound };

    if (message.important === important) {
      return {
        status: "success",
        message: important ? "Déjà signalé." : "Signalement déjà retiré.",
      };
    }

    const updated = await setMessageImportant(message.id, {
      from: message.important,
      to: important,
    });
    if (!updated) {
      revalidateMessages();
      return { status: "error", message: MESSAGES.conflict };
    }

    logSecurity({
      type: "message_flagged",
      userId: user.id,
      messageId: message.id,
      important,
    });
    revalidateMessages();
    return {
      status: "success",
      message: important
        ? "Message signalé comme important."
        : "Signalement « important » retiré.",
    };
  } catch (error) {
    console.error(
      "[toggleMessageImportant]",
      { userId: user.id, messageId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}
