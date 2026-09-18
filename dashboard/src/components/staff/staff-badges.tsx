import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AVAILABILITY_LABELS,
  STAFF_KIND_LABELS,
  type Availability,
  type StaffKind,
} from "@/domain/staff/kind";
import { formatDateFr } from "@/lib/format";

/*
 * Badges du personnel (serveur) : le métier et la disponibilité. La table
 * valeur → variante vit ici, pas dans le domaine ; le libellé est toujours
 * affiché, la couleur n'est jamais seule.
 */
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const KIND_VARIANT: Record<StaffKind, BadgeVariant> = {
  livreur: "default",
  preparateur: "secondary",
  gestionnaire: "outline",
};

const AVAILABILITY_VARIANT: Record<Availability, BadgeVariant> = {
  disponible: "success",
  indisponible: "warning",
  conge: "outline",
  arret_maladie: "destructive",
};

/** Le libellé passe à la ligne dans une carte étroite (« Préparateur de commandes »). */
export function StaffKindBadge({ kind }: { kind: StaffKind }) {
  return (
    <Badge
      variant={KIND_VARIANT[kind]}
      className="h-auto min-h-5 max-w-full whitespace-normal"
    >
      {STAFF_KIND_LABELS[kind]}
    </Badge>
  );
}

/** Une personne partie : « Parti·e le 28 févr. 2026 » en gris, sa disponibilité ne compte plus. */
export function AvailabilityBadge({
  availability,
  active,
  leftAt = null,
}: {
  availability: Availability;
  active: boolean;
  leftAt?: string | null;
}) {
  if (!active) {
    return (
      <Badge variant="secondary">
        {leftAt ? `Parti·e le ${formatDateFr(leftAt)}` : "Parti·e"}
      </Badge>
    );
  }
  return (
    <Badge variant={AVAILABILITY_VARIANT[availability]}>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
      />
      {AVAILABILITY_LABELS[availability]}
    </Badge>
  );
}
