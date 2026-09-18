import {
  CircleAlert,
  ShieldAlert,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  SECURITY_FAMILY_LABELS,
  type SecurityTone,
} from "@/domain/security/events";
import { securityEventView } from "@/domain/security/rules";
import type { SecurityEventRecord } from "@/domain/security/types";
import { formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Les lignes du journal (serveur, aucun état). Un journal se parcourt à la
 * verticale et se lit vite : l'instant à gauche, ce qui s'est passé au milieu,
 * la famille à droite. La bande de couleur à gauche porte le TON, pour qu'un
 * refus, un geste irréversible ou la naissance d'un accès sautent aux yeux
 * dans une page de cinquante lignes sans qu'on ait à lire : rouge pour une
 * alerte, ambre pour une action sensible, VERT pour un compte créé.
 *
 * Aucun bouton, aucune action : on ne corrige pas une preuve. Les identifiants
 * techniques sont affichés tels quels, en tabulaire, parce que c'est ce qu'on
 * recolle à une commande ou à un compte pendant une enquête.
 */
const TONE_RING: Record<SecurityTone, string> = {
  alerte: "border-l-destructive bg-destructive/5",
  sensible: "border-l-warning bg-warning/5",
  creation: "border-l-success bg-success/5",
  normal: "border-l-border",
};

const TONE_ICON: Record<SecurityTone, typeof ShieldCheck> = {
  alerte: CircleAlert,
  sensible: ShieldAlert,
  creation: UserRoundPlus,
  normal: ShieldCheck,
};

const TONE_TEXT: Record<SecurityTone, string> = {
  alerte: "text-destructive",
  sensible: "text-warning",
  creation: "text-success",
  normal: "text-muted-foreground",
};

export function SecurityEventRows({
  events,
}: {
  events: readonly SecurityEventRecord[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => {
        const view = securityEventView(event);
        const Icon = TONE_ICON[view.tone];
        return (
          <li key={view.id}>
            <article
              aria-label={`${view.label}, ${formatDateTimeFr(view.at)}`}
              data-tone={view.tone}
              className={cn(
                "bg-card cv-auto flex flex-col gap-1.5 rounded-xl border border-l-4 p-3 shadow-sm @2xl/main:flex-row @2xl/main:items-baseline @2xl/main:gap-4",
                TONE_RING[view.tone],
              )}
            >
              <time
                dateTime={view.at}
                className="text-muted-foreground shrink-0 text-xs tabular-nums @2xl/main:w-44 @2xl/main:text-sm"
              >
                {formatDateTimeFr(view.at)}
              </time>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold",
                    TONE_TEXT[view.tone],
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {view.label}
                </p>
                <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
                  {view.description}
                </p>
              </div>

              <Badge variant="outline" className="shrink-0 self-start">
                {view.family === null
                  ? "Type inconnu"
                  : SECURITY_FAMILY_LABELS[view.family]}
              </Badge>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
