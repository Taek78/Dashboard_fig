"use client";

import {
  KeyRound,
  LoaderCircle,
  MailPlus,
  ShieldCheck,
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
import { CancelInvitationButton } from "@/components/accounts/cancel-invitation-button";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
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
 * Actions sur un compte existant (client) : prénom, nom et rôle modifiables
 * sur une ligne alignée avec l'e-mail en LECTURE SEULE (il se lit, se copie,
 * ne se change pas) ; puis activation, lien pour choisir un mot de passe
 * (envoyé par e-mail, le geste normal), dépannage par un mot de passe posé ici
 * avec la jauge de la politique, et suppression définitive avec confirmation.
 * Cinq petits formulaires, cinq Server Actions, un message de résultat chacun.
 * L'administrateur ne voit ni « Désactiver » ni « Supprimer » pour lui-même,
 * ni pour le dernier administrateur actif (`lastAdmin`) : un texte le dit, et
 * l'action refuse de toute façon. Un compte EN ATTENTE d'activation (sans mot
 * de passe) n'a ni « Désactiver » ni « Supprimer » : ses gestes sont
 * « Renvoyer l'invitation » et « Annuler l'invitation » (qui le supprime),
 * plus le dépannage par mot de passe, qui l'active.
 */
export function AccountEditor({
  account,
  isSelf,
  lastAdmin,
}: {
  account: ManagedUser;
  isSelf: boolean;
  /** Dernier administrateur actif : ni désactivable, ni rétrogradable, ni supprimable. */
  lastAdmin: boolean;
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
    firstName: `${account.id}-first-name`,
    lastName: `${account.id}-last-name`,
    email: `${account.id}-email`,
    role: `${account.id}-role`,
    password: `${account.id}-password`,
  };
  const protectedAccount = isSelf || lastAdmin;
  /** En attente d'activation : la personne n'a pas encore choisi son mot de passe. */
  const pending = !account.hasPassword;

  return (
    <div className="flex flex-col gap-4">
      <form
        key={`${account.firstName}|${account.lastName}|${account.role}`}
        action={updateAction}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="userId" value={account.id} />
        <div className="grid gap-3 @xl/main:grid-cols-2 @4xl/main:grid-cols-[1fr_1fr_1.4fr_11rem_auto] @4xl/main:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor={ids.firstName}>Prénom</Label>
            <Input
              id={ids.firstName}
              name="firstName"
              required
              maxLength={80}
              defaultValue={account.firstName}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.lastName}>Nom</Label>
            <Input
              id={ids.lastName}
              name="lastName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={account.lastName}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.email}>
              E-mail{" "}
              <span className="text-muted-foreground font-normal">
                (non modifiable)
              </span>
            </Label>
            <Input
              id={ids.email}
              type="email"
              readOnly
              value={account.email}
              className="bg-muted/40 text-muted-foreground cursor-default"
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
          <Button
            type="submit"
            variant="outline"
            disabled={updating}
            className="@xl/main:justify-self-start"
          >
            {updating ? <LoaderCircle className="animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
        <ActionStatus result={updateResult} />
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {!protectedAccount && !(pending && account.active) ? (
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
        {pending ? (
          <CancelInvitationButton account={account} />
        ) : !protectedAccount ? (
          <DeleteAccountButton account={account} />
        ) : null}
        {lastAdmin ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            Dernier administrateur actif : ce compte ne peut être ni désactivé,
            ni rétrogradé, ni supprimé.
          </p>
        ) : null}
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
