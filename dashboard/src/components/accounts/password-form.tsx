"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword } from "@/app/(dashboard)/profil/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/domain/auth/schemas";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/* Changement de son propre mot de passe (client : useActionState), vidé après succès. */
export function PasswordForm() {
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
          maxLength={200}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="newPassword">Nouveau mot de passe</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={200}
            aria-describedby="newPassword-help"
          />
          <p id="newPassword-help" className="text-muted-foreground text-xs">
            {PASSWORD_MIN_LENGTH} caractères au moins.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">Confirmer le nouveau</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            maxLength={200}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Enregistrement…
            </>
          ) : (
            "Changer le mot de passe"
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
      </div>
    </form>
  );
}
