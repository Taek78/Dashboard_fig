import { MessageActions } from "@/components/messages/message-actions";
import { MessageAttachments } from "@/components/messages/message-attachments";
import {
  ImportantBadge,
  MESSAGE_STATUS_ACCENT,
  MessageStatusBadge,
  MessageSubjectBadge,
  messageSurfaceClass,
  PinnedBadge,
} from "@/components/messages/message-badges";
import { MessageOrderDetails } from "@/components/messages/message-order";
import type { Message } from "@/domain/messages/types";
import { formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Le message complet (serveur) : objet, étiquettes, commande jointe (dates,
 * adresse, préparateur, livreur), texte intégral, pièces jointes, puis les
 * actions de traitement. Important = fond en dégradé rouge, comme la carte.
 *
 * Le corps est rendu en `whitespace-pre-wrap` : les retours à la ligne sont
 * ceux que la personne a tapés, et rien n'est interprété comme du balisage
 * (c'est du texte, affiché par React, donc échappé).
 */
export function MessageDetail({
  message,
  canHandle,
}: {
  message: Message;
  canHandle: boolean;
}) {
  return (
    <article
      aria-label={`Message de ${message.customer.fullName}`}
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-4 rounded-2xl border-l-4 p-4 shadow-sm ring-1 @2xl/main:p-5",
        MESSAGE_STATUS_ACCENT[message.status],
        messageSurfaceClass(message.important),
      )}
    >
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Demande du client
          </h2>
          <MessageSubjectBadge
            subject={message.subject}
            className="self-start"
          />
          <p className="text-muted-foreground text-sm">
            Reçu le {formatDateTimeFr(message.receivedAt)}
            {message.handledAt
              ? ` · traité le ${formatDateTimeFr(message.handledAt)}${
                  message.handledByName ? ` par ${message.handledByName}` : ""
                }`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {message.pinnedAt ? <PinnedBadge /> : null}
          {message.important ? <ImportantBadge /> : null}
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {message.order ? <MessageOrderDetails order={message.order} /> : null}

      <p className="text-base [overflow-wrap:anywhere] whitespace-pre-wrap">
        {message.body}
      </p>

      <MessageAttachments attachments={message.attachments} />

      <div className="border-t pt-4">
        {canHandle ? (
          <MessageActions
            messageId={message.id}
            status={message.status}
            pinned={message.pinnedAt !== null}
            important={message.important}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Compte en lecture seule.
          </p>
        )}
      </div>
    </article>
  );
}
