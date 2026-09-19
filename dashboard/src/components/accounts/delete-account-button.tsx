"use client";

import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { deleteAccount } from "@/app/(dashboard)/comptes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCOUNT_DELETE_CONFIRM_WORD,
  type ManagedUser,
} from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";

/*
 * Suppression définitive d'un compte en deux temps (client), même mécanique
 * que le personnel et le catalogue : encart d'avertissement, mot SUPPRIMER
 * exigé ici (en toute casse) et par zod côté serveur. La page ne montre ce
 * bouton ni pour son propre compte ni pour le dernier administrateur actif ;
 * l'action refuse les deux de toute façon. Après la suppression, la carte
 * disparaît avec la revalidation de la page.
 */
export function DeleteAccountButton({
  account,
}: {
  account: Pick<ManagedUser, "id" | "name" | "email">;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, formAction, pending] = useActionState(
    deleteAccount,
    idleActionResult,
  );
  const inputId = useId();
  const ready = typed.trim().toUpperCase() === ACCOUNT_DELETE_CONFIRM_WORD;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Supprimer ce compte
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
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>
            Suppression définitive du compte de {account.name} ({account.email}
            ).
          </strong>{" "}
          Ses sessions sont fermées aussitôt et ses liens en cours annulés ;
          l&apos;historique des commandes garde son nom. Pour un départ,
          préférez « Désactiver » : le compte reste consultable.
        </span>
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={inputId}>
          Tapez <span className="font-mono">{ACCOUNT_DELETE_CONFIRM_WORD}</span>{" "}
          pour confirmer
        </Label>
        <Input
          id={inputId}
          name="confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="max-w-56"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={!ready || pending}
        >
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
        >
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
