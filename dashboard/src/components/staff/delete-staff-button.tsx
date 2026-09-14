"use client";

import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { removeStaffMember } from "@/app/(dashboard)/personnel/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAFF_DELETE_CONFIRM_WORD } from "@/domain/staff/types";
import { idleActionResult } from "@/lib/action-result";

/*
 * Suppression définitive d'une personne en deux temps (client), même
 * mécanique que le catalogue : encart d'avertissement, mot SUPPRIMER exigé
 * ici et par zod côté serveur. Les commandes déjà affectées perdent
 * l'affectation (clé étrangère « set null ») ; pour garder l'historique,
 * décocher « Dans l'équipe » suffit.
 */
export function DeleteStaffButton({
  staffId,
  name,
}: {
  staffId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, formAction, pending] = useActionState(
    removeStaffMember,
    idleActionResult,
  );
  const inputId = useId();
  const ready = typed.trim().toUpperCase() === STAFF_DELETE_CONFIRM_WORD;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Supprimer cette personne
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="staffId" value={staffId} />
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>Suppression définitive de {name}.</strong> Les commandes
          qu&apos;elle a préparées ou livrées perdent son nom. Pour garder
          l&apos;historique d&apos;une personne qui part, décochez plutôt « Dans
          l&apos;équipe ».
        </span>
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={inputId}>
          Tapez <span className="font-mono">{STAFF_DELETE_CONFIRM_WORD}</span>{" "}
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
