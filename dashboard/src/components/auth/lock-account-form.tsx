"use client";

import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useActionState } from "react";
import { lockOwnAccount } from "@/app/connexion/verrouiller/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/action-result";

/*
 * « Ce n'était pas moi » : un seul bouton, qui agit par POST (le lien du mail
 * n'a rien fait en s'ouvrant). Après succès, le bouton disparaît.
 */
export function LockAccountForm({ token }: { token: string }) {
  const [result, formAction, pending] = useActionState(
    lockOwnAccount,
    idleActionResult,
  );

  return (
    <form action={formAction} className="login-stagger flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {result.status !== "success" ? (
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          disabled={pending}
          className="w-full"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ShieldAlert />
          )}
          {pending ? "Verrouillage…" : "Verrouiller mon compte"}
        </Button>
      ) : null}
      <ActionStatus result={result} />
    </form>
  );
}
