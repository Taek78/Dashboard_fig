import { User, Users } from "lucide-react";
import type { CommunityRef } from "@/domain/communities/types";
import {
  CLIENT_TYPE_LABELS,
  COMMUNITY_MEMBER_LABEL,
  type ClientType,
} from "@/domain/customers/client-type";
import { cn } from "@/lib/utils";

/*
 * Badges de type (serveur), avec leur code couleur (tokens --individual et
 * --community) et une icône : la couleur n'est jamais le seul signal.
 * - ClientTypeLabel : « Particulier » pour une personne, « Communauté » pour
 *   un groupe (carte et fiche d'une communauté).
 * - CustomerTypeLabels : ce qu'on affiche pour une PERSONNE, « Particulier »
 *   toujours, suivi du badge « Communauté » (et du nom du groupe) seulement
 *   si elle en est membre. Une personne n'est jamais une communauté, même
 *   quand elle en fait partie.
 * - Une COMMANDE porte son propre type (orderKindOf : particulier ou
 *   communauté, ClientTypeLabel) : une commande de communauté est groupée,
 *   en couleur communauté, la personne n'en est que l'interlocuteur.
 * Seul ce badge d'appartenance porte la couleur communauté chez une personne :
 * sa carte et son avatar restent en couleur « particulier ».
 * Le nom d'une communauté passe à la ligne au lieu de déborder : un badge ne
 * sort jamais de sa carte.
 */
const BADGE =
  "inline-flex max-w-full min-w-0 items-start gap-1.5 rounded-lg px-2 py-1 text-xs leading-snug font-medium";

export function ClientTypeLabel({
  type,
  className,
}: {
  type: ClientType;
  className?: string;
}) {
  const Icon = type === "communaute" ? Users : User;
  return (
    <span
      className={cn(
        BADGE,
        type === "communaute"
          ? "bg-community/15 text-community"
          : "bg-individual/15 text-individual",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="font-semibold">{CLIENT_TYPE_LABELS[type]}</span>
    </span>
  );
}

/** Badge « Communauté » d'une personne membre, avec le nom du groupe. */
export function CommunityMemberBadge({
  community,
  showName = true,
  className,
}: {
  community: CommunityRef;
  showName?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(BADGE, "bg-community/15 text-community", className)}>
      <Users aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 wrap-anywhere whitespace-normal">
        <span className="sr-only">Membre : </span>
        <span className="font-semibold">{COMMUNITY_MEMBER_LABEL}</span>
        {showName ? ` · ${community.name}` : null}
      </span>
    </span>
  );
}

export function CustomerTypeLabels({
  community,
  showName = true,
  className,
}: {
  community: CommunityRef | null;
  /** Affiche le nom de la communauté dans le badge d'appartenance. */
  showName?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex max-w-full min-w-0 flex-wrap items-start gap-1.5",
        className,
      )}
    >
      <ClientTypeLabel type="particulier" />
      {community ? (
        <CommunityMemberBadge community={community} showName={showName} />
      ) : null}
    </span>
  );
}
