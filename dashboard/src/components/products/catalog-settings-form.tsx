"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";
import { saveCatalogSettings } from "@/app/(dashboard)/catalogue/actions";
import { idleActionResult } from "@/lib/action-result";

/*
 * Paramètre du catalogue entre la recherche et la grille (client :
 * useActionState). Cocher ou décocher écrit aussitôt ; sans le droit de
 * modifier le catalogue, la case est affichée désactivée. Seule une erreur
 * s'affiche : le changement de statut des cartes suffit à confirmer.
 */
export function CatalogSettingsForm({
  sellWhenOutOfStock,
  canEdit,
}: {
  sellWhenOutOfStock: boolean;
  canEdit: boolean;
}) {
  const [result, formAction, pending] = useActionState(
    saveCatalogSettings,
    idleActionResult,
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="Paramètres du catalogue"
      className="bg-card ring-foreground/10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 shadow-sm ring-1"
    >
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium has-disabled:cursor-not-allowed has-disabled:opacity-70">
        <input
          type="checkbox"
          name="sellWhenOutOfStock"
          defaultChecked={sellWhenOutOfStock}
          disabled={!canEdit || pending}
          onChange={() => formRef.current?.requestSubmit()}
          className="accent-primary size-4"
        />
        Laisser en vente les produits dont le stock est à 0
      </label>
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className="text-primary size-4 animate-spin"
        />
      ) : null}
      {result.status === "error" ? (
        <p
          role="alert"
          className="text-destructive flex items-center gap-1.5 text-sm"
        >
          <CircleAlert className="size-4" aria-hidden="true" />
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
