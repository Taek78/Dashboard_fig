import Link from "next/link";
import { ArrowRight, Paperclip } from "lucide-react";
import { MessageActions } from "@/components/messages/message-actions";
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
import { messagePreview } from "@/domain/messages/rules";
import type { Message } from "@/domain/messages/types";
import { formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'un message dans la boîte de réception (serveur). Ce qu'on lit d'un
 * coup d'œil, dans l'ordre : QUI a écrit, sur QUEL objet, les DEUX PREMIÈRES
 * LIGNES de sa demande, puis de quoi agir.
 *
 * La bordure gauche porte le statut (ambre = non traité, vert = traité) et un
 * message signalé important prend un fond en dégradé rouge : deux signaux
 * différents, jamais la même couleur pour deux choses. Si le client a joint
 * une commande, une ligne dit quand elle est livrée et qui s'en occupe.
 *
 * Le nom mène au MESSAGE (c'est l'objet de la liste) ; un second lien discret
 * mène à la fiche du client. Pas de carte entièrement cliquable : elle
 * contient des boutons, et un lien qui les recouvre les rendrait
 * inatteignables au clavier.
 */
export function MessageCard({
  message,
  canHandle,
}: {
  message: Message;
  canHandle: boolean;
}) {
  const preview = messagePreview(message.body);
  const files = message.attachments.length;

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
          <h3 className="text-lg leading-tight font-semibold [overflow-wrap:anywhere]">
            <Link
              href={`/messages/${message.id}`}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {message.customer.fullName}
            </Link>
          </h3>
          <span className="text-muted-foreground truncate text-sm">
            {message.customer.email}
          </span>
          <MessageSubjectBadge
            subject={message.subject}
            className="self-start"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 @2xl/main:justify-end">
          {message.pinnedAt ? <PinnedBadge /> : null}
          {message.important ? <ImportantBadge /> : null}
          <MessageStatusBadge status={message.status} />
        </div>
      </div>

      {/* Les deux premières lignes : l'aperçu est une règle pure, le CSS ne fait que borner la hauteur. */}
      <p className="line-clamp-2 text-sm [overflow-wrap:anywhere]">{preview}</p>

      <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Reçu le</dt>
          <dd>{formatDateTimeFr(message.receivedAt)}</dd>
        </div>
        {files > 0 ? (
          <div className="flex items-center gap-1.5">
            <dt>
              <Paperclip className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Pièces jointes</span>
            </dt>
            <dd>
              {files} pièce{files > 1 ? "s" : ""} jointe{files > 1 ? "s" : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {message.order ? (
        <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
          <MessageOrderLine order={message.order} />
        </div>
      ) : null}

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
        <Link
          href={`/messages/${message.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "self-start @2xl/main:self-auto",
          )}
        >
          Lire le message
          <span className="sr-only"> de {message.customer.fullName}</span>
          <ArrowRight />
        </Link>
      </div>
    </article>
  );
}
