"use client";

import { CircleAlert, LoaderCircle, MailX } from "lucide-react";
import { useActionState, useState } from "react";
import { cancelInvitation } from "@/app/(dashboard)/comptes/actions";
import { Button } from "@/components/ui/button";
import type { ManagedUser } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";

/*
 * Annulation d'une invitation (client) : tant que la personne n'a pas choisi
 * son mot de passe, le compte n'a jamais servi ; l'annuler le supprime et le
 * lien reçu cesse de fonctionner. Deux temps comme la suppression, mais sans
 * mot à taper : il n'y a ni historique ni session à protéger. La page ne
 * montre ce bouton que pour un compte en attente ; l'action le revérifie.
 */
export function CancelInvitationButton({
  account,
  notify,
}: {
  account: Pick<ManagedUser, "id" | "name" | "email">;
  /** Case « Prévenir par mail » de la carte. */
  notify: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, formAction, pending] = useActionState(
    cancelInvitation,
    idleActionResult,
  );

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <MailX />
        Annuler l&apos;invitation
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex w-full flex-col gap-3 rounded-none border p-4"
    >
      <input type="hidden" name="userId" value={account.id} />
      {/* « 0 » puis « 1 » : la dernière valeur l'emporte (schéma notifyByMail). */}
      <input type="hidden" name="notify" value="0" />
      {notify ? <input type="hidden" name="notify" value="1" /> : null}
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>
            Annuler l&apos;invitation de {account.name} ({account.email}) ?
          </strong>{" "}
          Le compte est supprimé et le lien reçu ne fonctionnera plus.{" "}
          {notify
            ? "Si l'invitation était partie, un mail l'en informera."
            : "Aucun mail ne sera envoyé."}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Annulation…
            </>
          ) : (
            <>
              <MailX />
              Confirmer l&apos;annulation
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Retour
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
