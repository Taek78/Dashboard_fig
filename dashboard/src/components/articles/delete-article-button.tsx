"use client";

import { removeArticle } from "@/app/(dashboard)/articles/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/*
 * Suppression définitive d'un article : fenêtre de confirmation « Confirmer
 * / Annuler » (ConfirmDeleteButton, 2026-09-18), confirm=oui exigé aussi par
 * zod côté serveur. Un article n'est lié à aucune commande ; « Masquer »
 * reste la voie douce.
 */
export function DeleteArticleButton({
  articleId,
  articleTitle,
}: {
  articleId: string;
  articleTitle: string;
}) {
  return (
    <ConfirmDeleteButton
      action={removeArticle}
      fields={{ articleId }}
      label="Supprimer cet article"
      title={`Supprimer « ${articleTitle} » ?`}
      description="L'article disparaît de l'historique et de l'application. Pour le retirer sans le perdre, préférez « Masquer »."
    />
  );
}
