"use client";

import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { removeArticle } from "@/app/(dashboard)/articles/actions";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/action-result";

/*
 * Suppression définitive en deux temps (client) : un premier clic ouvre un
 * encart d'avertissement dans la page (role="alert"), le second envoie le
 * formulaire avec confirm=oui, exigé aussi par zod côté serveur. Pas de mot à
 * taper : contrairement à un produit, un article n'est lié à aucune commande,
 * et « Masquer » reste la voie douce.
 */
export function DeleteArticleButton({
  articleId,
  articleTitle,
}: {
  articleId: string;
  articleTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, formAction, pending] = useActionState(
    removeArticle,
    idleActionResult,
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Supprimer cet article
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="confirm" value="oui" />
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>Suppression définitive de « {articleTitle} ».</strong>{" "}
          L&apos;article disparaît de l&apos;historique et de
          l&apos;application. Pour le retirer sans le perdre, préférez « Masquer
          ».
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Suppression…
            </>
          ) : (
            <>
              <Trash2 />
              Supprimer définitivement
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {result.status === "error" ? (
        <p role="status" className="text-destructive text-sm">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
