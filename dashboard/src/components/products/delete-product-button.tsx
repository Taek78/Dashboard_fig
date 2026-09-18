"use client";

import { removeProduct } from "@/app/(dashboard)/catalogue/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/*
 * Suppression définitive d'un produit : fenêtre de confirmation « Confirmer /
 * Annuler » (ConfirmDeleteButton, 2026-09-18), confirm=oui exigé aussi par
 * zod côté serveur. `compact` : sur une carte de la grille, le déclencheur
 * est une icône, nommée d'après le produit.
 */
export function DeleteProductButton({
  productId,
  productName,
  compact = false,
}: {
  productId: string;
  productName: string;
  compact?: boolean;
}) {
  return (
    <ConfirmDeleteButton
      action={removeProduct}
      fields={{ productId }}
      compact={compact}
      label={compact ? `Supprimer ${productName}` : "Supprimer ce produit"}
      title={`Supprimer « ${productName} » ?`}
      description="Le produit disparaît du catalogue et de l'application. Les commandes passées gardent leurs lignes. Pour le retirer sans le perdre, décochez plutôt « Visible dans l'application »."
    />
  );
}
