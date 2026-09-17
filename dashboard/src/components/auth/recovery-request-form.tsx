"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState } from "react";
import { requestRecoveryCode } from "@/app/connexion/recuperation/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionResult } from "@/lib/action-result";

/* Étape 1 de « Mot de passe oublié » : l'adresse ; le succès redirige vers l'étape du code. */
export function RecoveryRequestForm({
  defaultEmail = "",
}: {
  defaultEmail?: string;
}) {
  const [result, formAction, pending] = useActionState(
    requestRecoveryCode,
    idleActionResult,
  );

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mail du compte</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          defaultValue={defaultEmail}
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
        {pending ? "Envoi…" : "Envoyer le code"}
      </Button>
      <ActionStatus result={result} />
    </form>
  );
}
