import {
  Building2,
  Globe,
  House,
  Lock,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  COMMUNITY_KIND_LABELS,
  COMMUNITY_VISIBILITY_LABELS,
  type CommunityKind,
  type CommunityVisibility,
} from "@/domain/communities/kind";
import type { Community } from "@/domain/communities/types";
import { cn } from "@/lib/utils";

/*
 * Bandeau d'une communauté (serveur), en tête de sa carte et de sa fiche : son
 * type (voisinage, entreprise, point relais) à gauche, sa visibilité à droite.
 * Chaque information a son icône et son texte, la couleur n'est jamais le seul
 * signal. « Privé » (sur invitation) est plein et « Public » (intégration
 * directe) en contour : les deux se distinguent d'un coup d'œil, sans détourner
 * un token sémantique (une communauté privée n'est ni une alerte ni une erreur).
 */
const KIND_ICONS: Record<CommunityKind, LucideIcon> = {
  voisinage: House,
  entreprise: Building2,
  point_relais: Store,
};

const VISIBILITY_ICONS: Record<CommunityVisibility, LucideIcon> = {
  public: Globe,
  private: Lock,
};

export function CommunityBanner({
  community,
  className,
}: {
  community: Pick<Community, "kind" | "visibility">;
  className?: string;
}) {
  const KindIcon = KIND_ICONS[community.kind];
  const VisibilityIcon = VISIBILITY_ICONS[community.visibility];
  const isPrivate = community.visibility === "private";
  return (
    <div
      className={cn(
        "bg-community/12 text-community flex flex-wrap items-center justify-between gap-2 px-4 py-2",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KindIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>
          <span className="sr-only">Type : </span>
          {COMMUNITY_KIND_LABELS[community.kind]}
        </span>
      </p>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          isPrivate
            ? "bg-foreground text-background"
            : "text-foreground ring-foreground/40 ring-1",
        )}
      >
        <VisibilityIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span>
          <span className="sr-only">Visibilité : </span>
          {COMMUNITY_VISIBILITY_LABELS[community.visibility]}
        </span>
      </p>
    </div>
  );
}
