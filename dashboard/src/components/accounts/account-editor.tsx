"use client";

import {
  KeyRound,
  LoaderCircle,
  MailPlus,
  UserCheck,
  UserX,
} from "lucide-react";
import { useActionState, useState } from "react";
import {
  resetAccountPassword,
  sendPasswordLink,
  setAccountActive,
  updateAccount,
} from "@/app/(dashboard)/comptes/actions";
import { ActionStatus } from "@/components/action-status";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES } from "@/domain/auth/roles";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";
import type { ManagedUser } from "@/domain/auth/types";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Actions sur un compte existant (client) : nom et rôle, activation, lien
 * pour choisir un mot de passe (envoyé par e-mail, le geste normal), et en
 * dépannage un mot de passe posé ici avec la jauge de la politique. Quatre
 * petits formulaires, quatre Server Actions, un message de résultat chacun.
 * L'administrateur ne voit pas de bouton pour se désactiver lui-même
 * (l'action le refuse de toute façon).
 */
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
  const [linkResult, linkAction, sendingLink] = useActionState(
    sendPasswordLink,
    idleActionResult,
  );
  const [resetResult, resetAction, resetting] = useActionState(
    resetAccountPassword,
    idleActionResult,
  );
  const [resetOpen, setResetOpen] = useState(false);
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
              minLength={2}
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
        <ActionStatus result={updateResult} />
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
        {account.active ? (
          <form action={linkAction}>
            <input type="hidden" name="userId" value={account.id} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={sendingLink}
              title={`Envoie par e-mail un lien pour choisir un mot de passe, valable ${AUTH_TOKEN_RULES.invitation.validity}`}
            >
              {sendingLink ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <MailPlus />
              )}
              {account.hasPassword
                ? "Envoyer un lien"
                : "Renvoyer l'invitation"}
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
        <ActionStatus result={activeResult} />
        <ActionStatus result={linkResult} />
      </div>

      {resetOpen ? (
        <form
          action={resetAction}
          className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-3"
        >
          <input type="hidden" name="userId" value={account.id} />
          <p className="text-muted-foreground text-xs">
            Dépannage quand le mail ne passe pas : préférez « Envoyer un lien »,
            la personne choisit alors son mot de passe elle-même.
          </p>
          <PasswordField
            id={ids.password}
            name="password"
            label={`Nouveau mot de passe pour ${account.name}`}
            context={{ email: account.email, name: account.name }}
          />
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
          <ActionStatus result={resetResult} />
        </form>
      ) : null}
    </div>
  );
}
