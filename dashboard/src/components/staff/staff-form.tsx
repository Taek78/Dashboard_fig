"use client";

import { CircleAlert, CircleCheck, LoaderCircle, UserPlus } from "lucide-react";
import { useActionState } from "react";
import {
  addStaffMember,
  saveStaffMember,
} from "@/app/(dashboard)/personnel/actions";
import { DepartureField } from "@/components/staff/departure-field";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  SHIFT_LABELS,
  SHIFTS,
  STAFF_KIND_LABELS,
  STAFF_KINDS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type StaffKind,
} from "@/domain/staff/kind";
import {
  STAFF_NAME_MAX_LENGTH,
  STAFF_NOTES_MAX_LENGTH,
  type StaffMember,
} from "@/domain/staff/types";
import type { StaffTemplate } from "@/domain/staff/rules";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire d'une personne de l'équipe, création ET modification (client :
 * useActionState). `member` absent → addStaffMember (redirige vers la fiche
 * créée), présent → saveStaffMember. Tout est non contrôlé : la validation
 * est faite par zod côté serveur. Les jours travaillés sont des cases à
 * cocher de même nom (workDays) : l'action les lit avec formData.getAll.
 * `template` (duplication) préremplit métier, créneau, disponibilité, jours
 * d'une création ; l'identité reste vide et la copie est dans l'entreprise. La case « Parti de
 * l'entreprise » et la date de sortie sont dans DepartureField.
 */
const field = "grid gap-1.5";
const DEFAULT_DAYS = ["lun", "mar", "mer", "jeu", "ven"];

export function StaffForm({
  member,
  template,
  defaultKind = "livreur",
}: {
  member?: StaffMember;
  /** Fiche dupliquée : ce qu'une création reprend (staffTemplate). */
  template?: StaffTemplate;
  /** Métier présélectionné à la création (onglet d'où l'on vient). */
  defaultKind?: StaffKind;
}) {
  const [result, formAction, pending] = useActionState(
    member ? saveStaffMember : addStaffMember,
    idleActionResult,
  );
  // Quitter la page avec des modifications non enregistrées demande confirmation.
  const { formRef, dialog } = useUnsavedChanges(result);
  const workDays = member?.workDays ?? template?.workDays ?? DEFAULT_DAYS;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      {dialog}
      {member ? <input type="hidden" name="staffId" value={member.id} /> : null}
      <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Identité</legend>
        <div className={field}>
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            required
            maxLength={STAFF_NAME_MAX_LENGTH}
            defaultValue={member?.firstName ?? ""}
            autoComplete="off"
          />
        </div>
        <div className={field}>
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            name="lastName"
            required
            maxLength={STAFF_NAME_MAX_LENGTH}
            defaultValue={member?.lastName ?? ""}
            autoComplete="off"
          />
        </div>
        <div className={field}>
          <Label htmlFor="kind">Métier</Label>
          <NativeSelect
            id="kind"
            name="kind"
            defaultValue={member?.kind ?? template?.kind ?? defaultKind}
            className="w-full"
          >
            {STAFF_KINDS.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {STAFF_KIND_LABELS[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className={field}>
          <Label htmlFor="startedAt">Date d&apos;entrée</Label>
          <Input
            id="startedAt"
            name="startedAt"
            type="date"
            required
            defaultValue={member?.startedAt ?? ""}
            className="dark:scheme-dark"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Coordonnées</legend>
        <div className={field}>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={member?.email ?? ""}
            autoComplete="off"
          />
        </div>
        <div className={field}>
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            maxLength={30}
            defaultValue={member?.phone ?? ""}
            placeholder="06 12 34 56 78"
            autoComplete="off"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 @2xl/main:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">
          Horaires et disponibilité
        </legend>
        <div className={field}>
          <Label htmlFor="shift">Créneau de travail</Label>
          <NativeSelect
            id="shift"
            name="shift"
            defaultValue={member?.shift ?? template?.shift ?? "matin"}
            className="w-full"
          >
            {SHIFTS.map((shift) => (
              <NativeSelectOption key={shift} value={shift}>
                {SHIFT_LABELS[shift]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className={field}>
          <Label htmlFor="availability">Disponibilité</Label>
          <NativeSelect
            id="availability"
            name="availability"
            defaultValue={
              member?.availability ?? template?.availability ?? "disponible"
            }
            className="w-full"
          >
            {AVAILABILITIES.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {AVAILABILITY_LABELS[a]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <fieldset className="@2xl/main:col-span-2">
          <legend className="mb-2 text-sm font-medium">Jours travaillés</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary flex cursor-pointer items-center gap-2 rounded-none border px-3 py-1.5 text-sm select-none"
              >
                <input
                  type="checkbox"
                  name="workDays"
                  value={day}
                  defaultChecked={workDays.includes(day)}
                  className="accent-primary size-4"
                />
                {WEEKDAY_LABELS[day]}
              </label>
            ))}
          </div>
        </fieldset>
        <DepartureField
          departed={member ? !member.active : false}
          leftAt={member?.leftAt ?? null}
          name={member ? `${member.firstName} ${member.lastName}` : undefined}
        />
      </fieldset>

      <div className={field}>
        <Label htmlFor="notes">Notes internes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={STAFF_NOTES_MAX_LENGTH}
          defaultValue={member?.notes ?? ""}
          placeholder="Véhicule, secteur…"
          aria-describedby="notes-aide"
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-none border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
        />
        <p id="notes-aide" className="text-muted-foreground text-xs">
          Pas de donnée sensible (RGPD).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="brand"
          size="lg"
          disabled={pending}
          className="w-full @xl/main:w-auto"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : member ? null : (
            <UserPlus />
          )}
          {pending
            ? "Enregistrement…"
            : member
              ? "Enregistrer les modifications"
              : "Ajouter à l'équipe"}
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
