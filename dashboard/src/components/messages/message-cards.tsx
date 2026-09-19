import { Inbox, Pin } from "lucide-react";
import { FreshMark } from "@/components/alerts/fresh-mark";
import { MessageCard } from "@/components/messages/message-card";
import type { Message } from "@/domain/messages/types";

/*
 * Pile de cartes de la boîte de réception (serveur), en DEUX GROUPES séparés
 * visuellement (demande du client) : les épinglés, sous un titre bleu avec
 * l'épingle, puis les autres messages sous le leur. Un groupe vide n'affiche
 * rien ; une page sans épinglé (deuxième page) affiche la pile seule, sans
 * titre inutile.
 */
function Group({
  title,
  icon: Icon,
  tone,
  messages,
  canHandle,
}: {
  title: string;
  icon: typeof Pin;
  tone: string;
  messages: Message[];
  canHandle: boolean;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        <Icon className="size-4" aria-hidden="true" />
        {title}
        <span className="text-muted-foreground font-normal">
          · {messages.length}
        </span>
        <span aria-hidden="true" className="bg-border ml-2 h-px flex-1" />
      </h2>
      <ul className="flex flex-col gap-4">
        {messages.map((message) => (
          <li key={message.id}>
            <FreshMark kind="messages" id={message.id}>
              <MessageCard message={message} canHandle={canHandle} />
            </FreshMark>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MessageCards({
  messages,
  canHandle,
}: {
  messages: Message[];
  canHandle: boolean;
}) {
  const pinned = messages.filter((m) => m.pinnedAt !== null);
  const others = messages.filter((m) => m.pinnedAt === null);

  if (pinned.length === 0) {
    return (
      <ul className="flex flex-col gap-4">
        {others.map((message) => (
          <li key={message.id}>
            <FreshMark kind="messages" id={message.id}>
              <MessageCard message={message} canHandle={canHandle} />
            </FreshMark>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Group
        title="Épinglés"
        icon={Pin}
        tone="text-info"
        messages={pinned}
        canHandle={canHandle}
      />
      {others.length > 0 ? (
        <Group
          title="Autres messages"
          icon={Inbox}
          tone="text-muted-foreground"
          messages={others}
          canHandle={canHandle}
        />
      ) : null}
    </div>
  );
}
