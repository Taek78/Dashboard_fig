"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { addCustomerNote } from "@/app/(dashboard)/clients/[id]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NOTE_MAX_LENGTH } from "@/domain/customers/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire d'ajout d'une note interne (client : useActionState). Après un
 * succès, le champ est vidé : la note apparaît dans la liste au-dessus grâce à
 * revalidatePath, la garder dans le champ inviterait à la renvoyer.
 */
export function CustomerNoteForm({ customerId }: { customerId: string }) {
  const [result, formAction, pending] = useActionState(
    addCustomerNote,
    idleActionResult,
  );
  // Une note commencée : quitter la page demande confirmation.
  const { formRef, dialog } = useUnsavedChanges(result);

  useEffect(() => {
    if (result.status === "success") formRef.current?.reset();
  }, [result, formRef]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {dialog}
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid gap-1.5">
        <Label htmlFor="text">Nouvelle note interne</Label>
        <textarea
          id="text"
          name="text"
          required
          maxLength={NOTE_MAX_LENGTH}
          rows={3}
          placeholder="Visible uniquement par l'équipe."
          aria-describedby="text-aide"
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
        />
        <p id="text-aide" className="text-muted-foreground text-xs">
          Utile au service seulement, jamais de donnée sensible (RGPD).
        </p>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="w-full @xl/main:w-auto @xl/main:self-start"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Enregistrement…
          </>
        ) : (
          "Ajouter la note"
        )}
      </Button>
      <p
        role="status"
        className={cn(
          "flex items-center gap-1.5 text-sm",
          result.status === "success" && "text-success",
          result.status === "error" && "text-destructive",
        )}
      >
        {result.status === "success" ? (
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
        ) : null}
        {result.status === "error" ? (
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        ) : null}
        {result.status === "idle" ? null : result.message}
      </p>
    </form>
  );
}
