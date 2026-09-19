"use client";

import { LoaderCircle, UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { createAccount } from "@/app/(dashboard)/comptes/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES } from "@/domain/auth/roles";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";
import { idleActionResult } from "@/lib/action-result";

/*
 * Création d'un compte par l'administrateur (client : useActionState), SANS
 * mot de passe : la personne reçoit un lien d'invitation (48 h) et choisit le
 * sien. Quatre champs de même hauteur sur une grille (deux colonnes dès @2xl,
 * quatre dès @4xl), aucune aide sous un champ (elles désalignaient la ligne) :
 * une seule phrase sous la grille. Prénom et nom sont uniques ensemble ; le
 * nom seul sert au rappel de l'adresse (« Adresse e-mail oubliée ? »).
 * Le formulaire est vidé après succès.
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
      <div className="grid gap-4 @2xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="new-first-name">Prénom</Label>
          <Input
            id="new-first-name"
            name="firstName"
            autoComplete="off"
            required
            maxLength={80}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-last-name">Nom</Label>
          <Input
            id="new-last-name"
            name="lastName"
            autoComplete="off"
            required
            minLength={2}
            maxLength={80}
          />
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
      </div>
      <p className="text-muted-foreground text-xs">
        Un lien d&apos;activation part par mail (valable{" "}
        {AUTH_TOKEN_RULES.invitation.validity}). L&apos;e-mail ne pourra plus
        être modifié.
      </p>
      <div className="flex flex-col gap-3 @xl/main:flex-row @xl/main:items-center">
        <Button
          type="submit"
          variant="brand"
          disabled={pending}
          className="w-full @xl/main:w-auto"
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
          Créer le compte et envoyer l&apos;invitation
        </Button>
        <ActionStatus result={result} />
      </div>
    </form>
  );
}
