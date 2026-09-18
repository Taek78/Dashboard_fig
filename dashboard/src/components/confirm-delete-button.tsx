"use client";

import { useActionState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { idleActionResult, type ActionResult } from "@/lib/action-result";
import { DELETE_CONFIRMED } from "@/lib/confirm-delete";

/*
 * Suppression avec FENÊTRE DE CONFIRMATION (demande du 2026-09-18), commune
 * au produit, au membre du personnel et à l'article ; les comptes gardent
 * le mot SUPPRIMER à taper. Même boîte que la déconnexion (ui/alert-dialog,
 * Base UI) : focus d'abord sur « Annuler », Échap referme, un clic sur le
 * fond ne ferme pas (il faut répondre). « Confirmer » envoie le formulaire
 * avec les champs cachés de l'élément et confirm=oui, exigé par l'action.
 * L'action redirige après une suppression réussie ; en cas d'échec, le
 * message s'affiche dans la boîte (role="alert"), qui reste ouverte.
 * `compact` : sur une carte, le déclencheur est une icône.
 */
export function ConfirmDeleteButton({
  action,
  fields,
  label,
  title,
  description,
  compact = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /** Champs cachés envoyés à l'action (l'identifiant de l'élément). */
  fields: Record<string, string>;
  /** Libellé du déclencheur, et son nom accessible en mode compact. */
  label: string;
  title: string;
  description: ReactNode;
  compact?: boolean;
}) {
  const [result, formAction, pending] = useActionState(
    action,
    idleActionResult,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={compact ? "icon-sm" : "default"}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive group/delete"
            title={compact ? label : undefined}
            aria-label={compact ? label : undefined}
          />
        }
      >
        <Trash2 className="motion-safe:transition-transform motion-safe:group-hover/delete:scale-110 motion-safe:group-hover/delete:-rotate-12" />
        {compact ? null : label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <Trash2 className="size-5 motion-safe:animate-pulse" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <AlertDialogTitle className="wrap-anywhere">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </div>
        </div>
        <form
          action={formAction}
          className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="confirm" value={DELETE_CONFIRMED} />
          <AlertDialogClose render={<Button type="button" variant="outline" />}>
            Annuler
          </AlertDialogClose>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 />
                Confirmer
              </>
            )}
          </Button>
        </form>
        {result.status === "error" ? (
          <p
            role="alert"
            className="text-destructive flex items-start gap-2 text-sm"
          >
            <CircleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {result.message}
          </p>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
