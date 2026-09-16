"use client";

import { CircleAlert, EyeOff, LoaderCircle } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { anonymizeCustomerData } from "@/app/(dashboard)/clients/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ANONYMIZE_CONFIRM_WORD } from "@/domain/privacy/anonymization";
import { idleActionResult } from "@/lib/action-result";

/*
 * Anonymisation d'un client en deux temps (client), même mécanique que les
 * suppressions : encart d'avertissement qui dit ce qui disparaît et ce qui
 * reste, mot ANONYMISER exigé ici et par zod côté serveur. Après succès, la
 * fiche se rerend anonymisée (revalidatePath) : l'encart disparaît avec elle.
 */
export function AnonymizeCustomerButton({
  customerId,
  name,
}: {
  customerId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, formAction, pending] = useActionState(
    anonymizeCustomerData,
    idleActionResult,
  );
  const inputId = useId();
  const ready = typed.trim().toUpperCase() === ANONYMIZE_CONFIRM_WORD;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive self-start"
        onClick={() => setOpen(true)}
      >
        <EyeOff />
        Anonymiser ce client
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <strong>Anonymisation irréversible de {name}.</strong>
          <span>
            Effacés : nom, e-mail, téléphone, ville, code postal, adhésion à une
            communauté, notes internes et précisions des annulations.
          </span>
          <span>
            Conservés : les commandes, leurs produits, montants et créneaux
            (obligation comptable). Pensez à exporter les données avant si la
            personne les a demandées.
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={inputId}>
          Tapez <span className="font-mono">{ANONYMIZE_CONFIRM_WORD}</span> pour
          confirmer
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
              Anonymisation…
            </>
          ) : (
            <>
              <EyeOff />
              Anonymiser définitivement
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
