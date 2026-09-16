"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useId, useRef } from "react";
import { assignOrderStaff } from "@/app/(dashboard)/commandes/[id]/actions";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ASSIGNMENT_ROLE_LABELS,
  type AssignmentRole,
  type StaffRef,
} from "@/domain/orders/assignment";
import { AVAILABILITY_LABELS, type Availability } from "@/domain/staff/kind";
import type { StaffOption } from "@/domain/staff/rules";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Liste déroulante d'affectation d'une personne à une commande (client :
 * useActionState). Choisir une option envoie aussitôt le formulaire (pas de
 * bouton « Enregistrer » : un geste, une écriture) ; l'option vide retire
 * l'affectation. Les options viennent de la page (règle pure côté serveur :
 * bon métier, actives) et l'action les revérifie de toute façon.
 *
 * Chaque personne porte une GOMMETTE : verte si elle est présente, rouge
 * sinon (congé ou indisponible, la raison suit en texte). Une liste
 * déroulante native n'accepte ni icône ni couleur CSS dans ses options,
 * surtout sur téléphone : la gommette est donc un caractère, lisible partout,
 * gardé dans la valeur choisie (le <select> fermé l'affiche aussi).
 * Après un succès, la page se re-rend avec la nouvelle valeur : la key posée
 * par le parent remet le <select> en phase.
 */
export const PRESENCE_DOTS = { present: "🟢", absent: "🔴" } as const;

export function presenceDot(availability: Availability): string {
  return availability === "disponible"
    ? PRESENCE_DOTS.present
    : PRESENCE_DOTS.absent;
}

/** « 🟢 Malik Dembélé » ou « 🔴 Ousmane Diagne · en congé ». */
export function staffOptionLabel(option: StaffOption): string {
  const reason =
    option.availability === "disponible"
      ? ""
      : ` · ${AVAILABILITY_LABELS[option.availability].toLowerCase()}`;
  return `${presenceDot(option.availability)} ${option.name}${reason}`;
}

export function StaffAssignField({
  orderId,
  role,
  current,
  options,
  icon,
}: {
  orderId: string;
  role: AssignmentRole;
  current: StaffRef | null;
  options: StaffOption[];
  icon: React.ReactNode;
}) {
  const [result, formAction, pending] = useActionState(
    assignOrderStaff,
    idleActionResult,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const known = current === null || options.some((o) => o.id === current.id);

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={`Affectation : ${ASSIGNMENT_ROLE_LABELS[role]}`}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="role" value={role} />
      {/* Précondition : si quelqu'un a changé l'affectation depuis l'affichage, rien n'est écrasé. */}
      <input type="hidden" name="expectedStaffId" value={current?.id ?? ""} />
      <label
        htmlFor={id}
        className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
      >
        <span aria-hidden="true" className="[&_svg]:size-3.5">
          {icon}
        </span>
        {ASSIGNMENT_ROLE_LABELS[role]}
      </label>
      <div className="flex items-center gap-2">
        <NativeSelect
          id={id}
          name="staffId"
          size="sm"
          defaultValue={current?.id ?? ""}
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
          className={cn("w-full", current && "font-medium")}
        >
          <NativeSelectOption value="">
            {current ? "Retirer l'affectation" : "Non affecté"}
          </NativeSelectOption>
          {!known && current ? (
            <NativeSelectOption value={current.id}>
              {current.name} (plus dans l&apos;équipe)
            </NativeSelectOption>
          ) : null}
          {options.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {staffOptionLabel(o)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span
          role="status"
          className={cn(
            "flex shrink-0 items-center [&_svg]:size-4",
            result.status === "success" && "text-success",
            result.status === "error" && "text-destructive",
          )}
        >
          {pending ? (
            <LoaderCircle className="text-muted-foreground animate-spin" />
          ) : result.status === "success" ? (
            <CircleCheck />
          ) : result.status === "error" ? (
            <CircleAlert />
          ) : null}
          <span className="sr-only">
            {pending
              ? "Enregistrement…"
              : result.status === "idle"
                ? ""
                : result.message}
          </span>
        </span>
      </div>
      {result.status === "error" ? (
        <p className="text-destructive text-xs">{result.message}</p>
      ) : null}
    </form>
  );
}
