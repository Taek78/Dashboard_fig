"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/connexion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionResult } from "@/lib/action-result";

/* Formulaire de connexion (client : useActionState). Le succès redirige, seul l'échec s'affiche. */
export function LoginForm() {
  const [result, formAction, pending] = useActionState(login, idleActionResult);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </Button>
      <p
        role="alert"
        className="text-destructive flex items-center gap-1.5 text-sm"
      >
        {result.status === "error" ? (
          <>
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {result.message}
          </>
        ) : null}
      </p>
    </form>
  );
}
