import { ArrowRight } from "lucide-react";
import { MessageActions } from "@/components/messages/message-actions";
import { AttachmentBadge } from "@/components/messages/message-attachments";
import {
  ImportantBadge,
  MESSAGE_STATUS_ACCENT,
  MessageStatusBadge,
  MessageSubjectBadge,
  messageSurfaceClass,
  PinnedBadge,
} from "@/components/messages/message-badges";
import { MessageOrderLine } from "@/components/messages/message-order";
import { buttonVariants } from "@/components/ui/button";
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { messagePreview } from "@/domain/messages/rules";
import type { Message } from "@/domain/messages/types";
import { formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'un message dans la boîte de réception (serveur). Ce qu'on lit d'un
 * coup d'œil, dans l'ordre : QUI a écrit, sur QUEL objet, la COMMANDE jointe
 * (quand, qui s'en occupe), les DEUX PREMIÈRES LIGNES de sa demande, puis de
 * quoi agir.
 *
 * La bordure gauche porte le statut (ambre = non traité, vert = traité) et un
 * message signalé important prend un fond en dégradé rouge : deux signaux
 * différents, jamais la même couleur pour deux choses. Une pièce jointe se
 * signale en violet (AttachmentBadge, token --attachment) : sa présence ne
 * doit pas se rater.
 *
 * Le nom mène à la FICHE DU CLIENT (comme tout nom de client dans le
 * dashboard) ; « Lire le message » mène au message. Pas de carte entièrement
 * cliquable : elle contient des boutons, et un lien qui les recouvre les
 * rendrait inatteignables au clavier.
 */
export function MessageCard({
  message,
  canHandle,
}: {
  message: Message;
  canHandle: boolean;
}) {
  const preview = messagePreview(message.body);

  return (
    <article
      aria-label={`Message de ${message.customer.fullName}`}
      className={cn(
        "bg-card text-card-foreground card-lift cv-auto flex flex-col gap-3 rounded-2xl border-l-4 p-4 shadow-sm ring-1 @2xl/main:p-5",
        MESSAGE_STATUS_ACCENT[message.status],
        messageSurfaceClass(message.important),
      )}
    >
      <div className="flex flex-col gap-2 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-lg leading-tight font-semibold wrap-anywhere">
            <HoverPrefetchLink
              href={`/clients/${message.customer.id}`}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {message.customer.fullName}
            </HoverPrefetchLink>
          </h3>
          <span className="text-muted-foreground truncate text-sm">
            {message.customer.email}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <MessageSubjectBadge subject={message.subject} />
            <AttachmentBadge count={message.attachments.length} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 @2xl/main:justify-end">
          {message.pinnedAt ? <PinnedBadge /> : null}
          {message.important ? <ImportantBadge /> : null}
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {message.order ? (
        <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
          <MessageOrderLine order={message.order} />
        </div>
      ) : null}

      {/* Les deux premières lignes : l'aperçu est une règle pure, le CSS ne fait que borner la hauteur. */}
      <p className="line-clamp-2 text-sm wrap-anywhere">{preview}</p>

      <p className="text-muted-foreground text-xs">
        <span className="sr-only">Reçu le </span>
        {formatDateTimeFr(message.receivedAt)}
      </p>

      <div className="flex flex-col gap-3 border-t pt-3 @2xl/main:flex-row @2xl/main:items-center @2xl/main:justify-between">
        {canHandle ? (
          <MessageActions
            messageId={message.id}
            status={message.status}
            pinned={message.pinnedAt !== null}
            important={message.important}
            compact
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Compte en lecture seule.
          </p>
        )}
        {/* Un vrai <a> et non <Button render> : celui-ci NAVIGUE, il doit donc
            être annoncé « lien » et non « bouton » (convention du projet). */}
        <HoverPrefetchLink
          href={`/messages/${message.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "self-start @2xl/main:self-auto",
          )}
        >
          Lire le message
          <span className="sr-only"> de {message.customer.fullName}</span>
          <ArrowRight />
        </HoverPrefetchLink>
      </div>
    </article>
  );
}
