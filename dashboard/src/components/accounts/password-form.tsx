"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword } from "@/app/(dashboard)/profil/actions";
import { ActionStatus } from "@/components/action-status";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";

/*
 * Changement de son propre mot de passe (client : useActionState), avec la
 * jauge de la politique sur le nouveau ; vidé après succès. `context` : le
 * nom du compte, pour la règle « ni votre nom ni votre e-mail ».
 */
export function PasswordForm({ context }: { context: { name: string } }) {
  const [result, formAction, pending] = useActionState(
    changeOwnPassword,
    idleActionResult,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result.status === "success") formRef.current?.reset();
  }, [result]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
        />
      </div>
      <div className="grid gap-4 @2xl/main:grid-cols-2">
        <PasswordField
          id="newPassword"
          label="Nouveau mot de passe"
          context={context}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">Confirmer le nouveau</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 @xl/main:flex-row @xl/main:items-center">
        <Button
          type="submit"
          disabled={pending}
          className="w-full @xl/main:w-auto"
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Enregistrement…
            </>
          ) : (
            "Changer le mot de passe"
          )}
        </Button>
        <ActionStatus result={result} />
      </div>
    </form>
  );
}
