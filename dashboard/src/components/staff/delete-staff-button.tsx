"use client";

import { removeStaffMember } from "@/app/(dashboard)/personnel/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/*
 * Suppression définitive d'une personne : fenêtre de confirmation
 * « Confirmer / Annuler » (ConfirmDeleteButton, 2026-09-18), confirm=oui
 * exigé aussi par zod côté serveur. Les commandes déjà affectées perdent
 * l'affectation (clé étrangère « set null ») ; pour garder l'historique,
 * décocher « Dans l'équipe » suffit. `compact` : sur une carte, le
 * déclencheur est une icône.
 */
export function DeleteStaffButton({
  staffId,
  name,
  compact = false,
}: {
  staffId: string;
  name: string;
  compact?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      action={removeStaffMember}
      fields={{ staffId }}
      compact={compact}
      label={compact ? `Supprimer ${name}` : "Supprimer cette personne"}
      title={`Supprimer ${name} ?`}
      description="Les commandes qu'elle a préparées ou livrées perdent son nom. Pour garder l'historique d'une personne qui part, décochez plutôt « Dans l'équipe »."
    />
  );
}
