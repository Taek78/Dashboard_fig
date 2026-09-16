"use client";

import {
  Check,
  Flag,
  LoaderCircle,
  Pin,
  PinOff,
  RotateCcw,
} from "lucide-react";
import { useActionState } from "react";
import {
  changeMessageStatus,
  toggleMessageImportant,
  toggleMessagePin,
} from "@/app/(dashboard)/messages/actions";
import { Button } from "@/components/ui/button";
import {
  MESSAGE_STATUS_ACTION_LABELS,
  toggledStatus,
  type MessageStatus,
} from "@/domain/messages/status";
import { idleActionResult } from "@/lib/action-result";

/*
 * Les trois bascules d'un message (client : useActionState). Chacune est un
 * formulaire séparé — elles écrivent des choses différentes et échouent
 * indépendamment — et n'envoie que l'état VISÉ : le serveur relit l'état réel
 * avant d'écrire, un bouton affiché sur une page périmée ne peut qu'échouer.
 *
 * Aucune confirmation : les trois gestes sont réversibles d'un clic (rien à
 * voir avec une suppression). Le message d'erreur s'affiche sous les boutons ;
 * en cas de succès, la page se rerend (revalidatePath) et les boutons
 * repartent dans l'autre sens.
 */
export function MessageActions({
  messageId,
  status,
  pinned,
  important,
  compact = false,
}: {
  messageId: string;
  status: MessageStatus;
  pinned: boolean;
  important: boolean;
  /** Sur une carte de liste : boutons plus petits. */
  compact?: boolean;
}) {
  const [statusResult, statusAction, statusPending] = useActionState(
    changeMessageStatus,
    idleActionResult,
  );
  const [pinResult, pinAction, pinPending] = useActionState(
    toggleMessagePin,
    idleActionResult,
  );
  const [flagResult, flagAction, flagPending] = useActionState(
    toggleMessageImportant,
    idleActionResult,
  );
  const size = compact ? "sm" : "default";
  const next = toggledStatus(status);
  const error = [statusResult, pinResult, flagResult].find(
    (result) => result.status === "error",
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={statusAction}>
          <input type="hidden" name="messageId" value={messageId} />
          <input type="hidden" name="nextStatus" value={next} />
          <Button
            type="submit"
            size={size}
            variant={status === "untreated" ? "brand" : "outline"}
            disabled={statusPending}
          >
            {statusPending ? (
              <LoaderCircle className="animate-spin" />
            ) : status === "untreated" ? (
              <Check />
            ) : (
              <RotateCcw />
            )}
            {MESSAGE_STATUS_ACTION_LABELS[status]}
          </Button>
        </form>

        <form action={pinAction}>
          <input type="hidden" name="messageId" value={messageId} />
          <input type="hidden" name="pinned" value={pinned ? "non" : "oui"} />
          <Button
            type="submit"
            size={size}
            variant="outline"
            disabled={pinPending}
          >
            {pinPending ? (
              <LoaderCircle className="animate-spin" />
            ) : pinned ? (
              <PinOff />
            ) : (
              <Pin />
            )}
            {pinned ? "Désépingler" : "Épingler"}
          </Button>
        </form>

        <form action={flagAction}>
          <input type="hidden" name="messageId" value={messageId} />
          <input
            type="hidden"
            name="important"
            value={important ? "non" : "oui"}
          />
          <Button
            type="submit"
            size={size}
            variant="outline"
            className={
              important
                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                : undefined
            }
            disabled={flagPending}
          >
            {flagPending ? <LoaderCircle className="animate-spin" /> : <Flag />}
            {important ? "Retirer « important »" : "Marquer important"}
          </Button>
        </form>
      </div>
      {error ? (
        <p role="status" className="text-destructive text-sm">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
