"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useActionState } from "react";
import { acceptInvitation } from "@/app/connexion/invitation/actions";
import { ActionStatus } from "@/components/action-status";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";

/* Lien d'invitation : la personne choisit son mot de passe ; le succès ouvre la session. */
export function InvitationForm({
  token,
  context,
}: {
  token: string;
  context: { email: string; name: string };
}) {
  const [result, formAction, pending] = useActionState(
    acceptInvitation,
    idleActionResult,
  );

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        id="newPassword"
        label="Votre mot de passe"
        context={context}
        autoFocus
      />
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">Confirmer</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
        />
      </div>
      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <LogIn />}
        {pending ? "Enregistrement…" : "Enregistrer et me connecter"}
      </Button>
      <ActionStatus result={result} />
    </form>
  );
}
