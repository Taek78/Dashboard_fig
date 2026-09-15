import { User, Users } from "lucide-react";
import type { CommunityRef } from "@/domain/communities/types";
import {
  CLIENT_TYPE_LABELS,
  clientTypeOf,
  type ClientType,
} from "@/domain/customers/client-type";
import { cn } from "@/lib/utils";

/*
 * Étiquette « Particulier » ou « Communauté » (serveur), avec son code couleur
 * (tokens --individual et --community) et une icône : la couleur n'est jamais
 * le seul signal. Le nom de la communauté passe à la ligne au lieu de
 * déborder (pas de nowrap, césure possible des mots longs) : une étiquette ne
 * sort jamais de sa carte. CLIENT_TYPE_TINT teinte la bande d'une carte.
 */
export const CLIENT_TYPE_TINT: Record<ClientType, string> = {
  particulier: "bg-individual/8",
  communaute: "bg-community/8",
};

export function ClientTypeLabel({
  community,
  showName = true,
  className,
}: {
  community: CommunityRef | null;
  /** Affiche le nom de la communauté après le type. */
  showName?: boolean;
  className?: string;
}) {
  const type = clientTypeOf(community);
  const Icon = type === "communaute" ? Users : User;
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-start gap-1.5 rounded-lg px-2 py-1 text-xs leading-snug font-medium",
        type === "communaute"
          ? "bg-community/15 text-community"
          : "bg-individual/15 text-individual",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere] whitespace-normal">
        <span className="font-semibold">{CLIENT_TYPE_LABELS[type]}</span>
        {showName && community ? ` · ${community.name}` : null}
      </span>
    </span>
  );
}
