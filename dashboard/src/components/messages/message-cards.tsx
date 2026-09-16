import { MessageCard } from "@/components/messages/message-card";
import type { Message } from "@/domain/messages/types";

/* Pile de cartes de la boîte de réception (serveur), les épinglées en tête. */
export function MessageCards({
  messages,
  canHandle,
}: {
  messages: Message[];
  canHandle: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageCard message={message} canHandle={canHandle} />
        </li>
      ))}
    </ul>
  );
}
