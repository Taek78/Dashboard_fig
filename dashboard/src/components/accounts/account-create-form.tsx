"use client";

import { CircleAlert, CircleCheck, LoaderCircle, UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { createAccount } from "@/app/(dashboard)/comptes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES } from "@/domain/auth/roles";
import { PASSWORD_MIN_LENGTH } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Création d'un compte par l'administrateur (client : useActionState). Le
 * formulaire est vidé après succès ; le mot de passe initial est à transmettre
 * par un canal sûr, la personne le change ensuite sur /profil.
 */
export function AccountCreateForm() {
  const [result, formAction, pending] = useActionState(
    createAccount,
    idleActionResult,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result.status === "success") formRef.current?.reset();
  }, [result]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 @2xl/main:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-name">Nom</Label>
          <Input id="new-name" name="name" required maxLength={80} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-email">E-mail</Label>
          <Input
            id="new-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-role">Rôle</Label>
          <NativeSelect
            id="new-role"
            name="role"
            defaultValue="gestionnaire"
            className="w-full"
          >
            {ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {ROLE_LABELS[role]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">Mot de passe initial</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={200}
            aria-describedby="new-password-help"
          />
          <p id="new-password-help" className="text-muted-foreground text-xs">
            {PASSWORD_MIN_LENGTH} caractères au moins.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 @xl/main:flex-row @xl/main:items-center">
        <Button
          type="submit"
          variant="brand"
          disabled={pending}
          className="w-full @xl/main:w-auto"
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
          Créer le compte
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
