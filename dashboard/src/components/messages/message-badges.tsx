import { CircleAlert, Flag, Mail, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  MESSAGE_STATUS_LABELS,
  type MessageStatus,
} from "@/domain/messages/status";
import {
  isClaimSubject,
  MESSAGE_SUBJECT_LABELS,
  type MessageSubject,
} from "@/domain/messages/subject";
import { cn } from "@/lib/utils";

/*
 * Les étiquettes colorées de la boîte de réception (serveur). Les tables
 * « valeur → couleur » vivent ICI et non dans le domaine : le domaine ne
 * connaît pas l'interface, c'est l'interface qui le traduit en couleurs.
 *
 * Quatre signaux, chacun sa couleur ET son texte (la couleur n'est jamais seule
 * à porter l'information) :
 *   - STATUT, bordure gauche de la carte : ambre = non traité (il reste à
 *     faire), vert = traité ;
 *   - IMPORTANT, drapeau rouge ET fond de carte en dégradé rouge, du coin haut
 *     gauche vers la carte (demande du client : un signal visible et clair) ;
 *   - ÉPINGLÉ, bleu : remonté en haut de la liste, dans son propre groupe ;
 *   - OBJET : rouge doux pour une réclamation (un préjudice à réparer), bleu
 *     pour une question ou un autre sujet.
 */
export const MESSAGE_STATUS_ACCENT: Record<MessageStatus, string> = {
  untreated: "border-l-warning",
  treated: "border-l-success",
};

/**
 * Surface d'une carte selon le signalement : dégradé rouge franc pour un
 * message important (teinte du token --destructive, lisible dans les trois
 * thèmes : le texte reste sur la carte, le rouge s'estompe vers elle), anneau
 * discret sinon.
 */
export function messageSurfaceClass(important: boolean): string {
  return important
    ? "ring-destructive/50 bg-gradient-to-br from-destructive/25 via-destructive/10 to-card dark:from-destructive/35 dark:via-destructive/15"
    : "ring-foreground/10";
}

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <Badge
      variant={status === "untreated" ? "warning" : "success"}
      className="h-7 gap-1.5 px-3 text-sm font-semibold ring-1 ring-current/25"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-current"
      />
      {MESSAGE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function MessageSubjectBadge({
  subject,
  className,
}: {
  subject: MessageSubject;
  className?: string;
}) {
  const claim = isClaimSubject(subject);
  const Icon = claim ? CircleAlert : Mail;
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-start gap-1.5 rounded-lg px-2 py-1 text-xs leading-snug font-medium",
        claim ? "bg-destructive/10 text-destructive" : "bg-info/12 text-info",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere] whitespace-normal">
        {MESSAGE_SUBJECT_LABELS[subject]}
      </span>
    </span>
  );
}

/** Drapeau « important », posé par l'équipe. */
export function ImportantBadge() {
  return (
    <Badge variant="destructive" className="gap-1 font-semibold">
      <Flag aria-hidden="true" />
      Important
    </Badge>
  );
}

/** « Épinglé » : ce message reste en haut de la liste. */
export function PinnedBadge() {
  return (
    <Badge className="bg-info/15 text-info gap-1 font-semibold">
      <Pin aria-hidden="true" />
      Épinglé
    </Badge>
  );
}
