"use client";

import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import { useActionState, useState } from "react";
import {
  resetAccountPassword,
  setAccountActive,
  updateAccount,
} from "@/app/(dashboard)/comptes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES } from "@/domain/auth/roles";
import { PASSWORD_MIN_LENGTH } from "@/domain/auth/types";
import type { ManagedUser } from "@/domain/auth/types";
import { idleActionResult, type ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Actions sur un compte existant (client) : nom et rôle, activation, nouveau
 * mot de passe. Trois petits formulaires, trois Server Actions, un message de
 * résultat chacun. L'administrateur ne voit pas de bouton pour se désactiver
 * lui-même (l'action le refuse de toute façon).
 */
function Status({ result }: { result: ActionResult }) {
  return (
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
  );
}

export function AccountEditor({
  account,
  isSelf,
}: {
  account: ManagedUser;
  isSelf: boolean;
}) {
  const [updateResult, updateAction, updating] = useActionState(
    updateAccount,
    idleActionResult,
  );
  const [activeResult, activeAction, toggling] = useActionState(
    setAccountActive,
    idleActionResult,
  );
  const [resetResult, resetAction, resetting] = useActionState(
    resetAccountPassword,
    idleActionResult,
  );
  const [resetting_open, setResetOpen] = useState(false);
  const ids = {
    name: `${account.id}-name`,
    role: `${account.id}-role`,
    password: `${account.id}-password`,
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        key={`${account.name}|${account.role}`}
        action={updateAction}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="userId" value={account.id} />
        <div className="grid gap-3 @xl/main:grid-cols-[1fr_12rem_auto] @xl/main:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.name}>Nom</Label>
            <Input
              id={ids.name}
              name="name"
              required
              maxLength={80}
              defaultValue={account.name}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.role}>Rôle</Label>
            <NativeSelect
              id={ids.role}
              name="role"
              defaultValue={account.role}
              className="w-full"
            >
              {ROLES.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {ROLE_LABELS[role]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="outline" disabled={updating}>
            {updating ? <LoaderCircle className="animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
        <Status result={updateResult} />
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {!isSelf ? (
          <form action={activeAction}>
            <input type="hidden" name="userId" value={account.id} />
            <input
              type="hidden"
              name="active"
              value={account.active ? "0" : "1"}
            />
            <Button
              type="submit"
              variant={account.active ? "ghost" : "secondary"}
              size="sm"
              disabled={toggling}
              className={cn(
                account.active &&
                  "text-destructive hover:bg-destructive/10 hover:text-destructive",
              )}
            >
              {toggling ? (
                <LoaderCircle className="animate-spin" />
              ) : account.active ? (
                <UserX />
              ) : (
                <UserCheck />
              )}
              {account.active ? "Désactiver" : "Réactiver"}
            </Button>
          </form>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setResetOpen((open) => !open)}
        >
          <KeyRound />
          Nouveau mot de passe
        </Button>
        <Status result={activeResult} />
      </div>

      {resetting_open ? (
        <form
          action={resetAction}
          className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-3"
        >
          <input type="hidden" name="userId" value={account.id} />
          <div className="grid gap-1.5">
            <Label htmlFor={ids.password}>
              Nouveau mot de passe pour {account.name}
            </Label>
            <Input
              id={ids.password}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={200}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={resetting}>
              {resetting ? <LoaderCircle className="animate-spin" /> : null}
              Enregistrer le mot de passe
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetOpen(false)}
            >
              Fermer
            </Button>
          </div>
          <Status result={resetResult} />
        </form>
      ) : null}
    </div>
  );
}
