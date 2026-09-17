"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState } from "react";
import { requestEmailReminder } from "@/app/connexion/adresse-oubliee/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionResult } from "@/lib/action-result";

/* « Adresse e-mail oubliée » : le nom seul (pas le prénom) ; la réponse est la même que le nom existe ou non. */
export function EmailReminderForm() {
  const [result, formAction, pending] = useActionState(
    requestEmailReminder,
    idleActionResult,
  );

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="lastName">Nom</Label>
        <Input
          id="lastName"
          name="lastName"
          autoComplete="family-name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Votre nom de famille"
          autoFocus
        />
      </div>
      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
        {pending ? "Envoi…" : "Envoyer le rappel"}
      </Button>
      <ActionStatus result={result} />
    </form>
  );
}
