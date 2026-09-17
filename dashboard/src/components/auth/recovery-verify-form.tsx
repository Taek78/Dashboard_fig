"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { verifyRecoveryCode } from "@/app/connexion/recuperation/actions";
import { ActionStatus } from "@/components/action-status";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH, RECOVERY_CODE_LENGTH } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";

/*
 * Étape 2 de « Mot de passe oublié » : le code reçu (six chiffres, en grand,
 * clavier numérique sur téléphone, rempli par le navigateur depuis le SMS ou
 * le mail quand il sait le faire : one-time-code) et le nouveau mot de passe
 * avec sa jauge. Le succès ouvre la session et redirige.
 */
export function RecoveryVerifyForm({ email }: { email: string }) {
  const [result, formAction, pending] = useActionState(
    verifyRecoveryCode,
    idleActionResult,
  );

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <div className="grid gap-1.5">
        <Label htmlFor="code">Code reçu par e-mail</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`[0-9 ]{${RECOVERY_CODE_LENGTH},${RECOVERY_CODE_LENGTH + 2}}`}
          maxLength={RECOVERY_CODE_LENGTH + 2}
          required
          autoFocus
          className="h-12 text-center font-mono text-2xl font-semibold tracking-[0.4em] md:text-2xl"
        />
      </div>
      <PasswordField
        id="newPassword"
        label="Nouveau mot de passe"
        context={{ email }}
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
      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={pending}
        className="w-full"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
        {pending ? "Vérification…" : "Changer le mot de passe"}
      </Button>
      <ActionStatus result={result} />
    </form>
  );
}
