"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/connexion/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { idleActionResult } from "@/lib/action-result";

/*
 * Formulaire de connexion (client : useActionState). Le succès redirige, seul
 * l'échec s'affiche. Sous le bouton, les deux secours : « Mot de passe
 * oublié ? » (code par e-mail) et « Adresse e-mail oubliée ? » (rappel par le
 * nom du compte). Le mot de passe a son bouton œil (PasswordInput) pour
 * vérifier la saisie. `login-stagger` : les champs entrent l'un après l'autre
 * (globals.css, « Connexion »), sans mouvement pour qui le refuse.
 */
const HELP_LINK =
  "text-primary text-sm font-medium underline-offset-4 hover:underline";

export function LoginForm() {
  const [result, formAction, pending] = useActionState(login, idleActionResult);

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
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
        <PasswordInput
          id="password"
          name="password"
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
      <ActionStatus
        role="alert"
        result={result.status === "error" ? result : idleActionResult}
      />
      <nav
        aria-label="Aide à la connexion"
        className="flex flex-wrap justify-between gap-x-4 gap-y-1"
      >
        <Link href="/connexion/recuperation" className={HELP_LINK}>
          Mot de passe oublié ?
        </Link>
        <Link href="/connexion/adresse-oubliee" className={HELP_LINK}>
          Adresse e-mail oubliée ?
        </Link>
      </nav>
    </form>
  );
}
