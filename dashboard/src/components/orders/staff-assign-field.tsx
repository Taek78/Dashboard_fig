"use client";

import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";
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
 * useActionState). Choisir une option écrit aussitôt (pas de bouton
 * « Enregistrer » : un geste, une écriture) ; l'option vide retire
 * l'affectation. Les options viennent de la page (règle pure côté serveur :
 * bon métier, actives) et l'action les revérifie de toute façon.
 *
 * Chaque personne porte une GOMMETTE : verte si elle est présente, rouge
 * sinon (congé ou indisponible, la raison suit en texte). Une liste
 * déroulante native n'accepte ni icône ni couleur CSS dans ses options,
 * surtout sur téléphone : la gommette est donc un caractère, lisible partout,
 * gardé dans la valeur choisie (le <select> fermé l'affiche aussi).
 *
 * Liste CONTRÔLÉE et FormData composé (2026-09-19) : React réinitialise un
 * formulaire après une Server Action, ce qui ramenait la liste sur l'option
 * vide (« Retirer l'affectation ») au lieu du nom choisi. La valeur suit le
 * choix, puis la personne relue par la page ; un refus la remet sur
 * l'affectation réelle.
 * Personne affectée INDISPONIBLE (demande du 2026-09-19) : icône
 * d'avertissement rouge animée (warn-wiggle) à côté de la liste, bordure
 * rouge, et la raison pour les lecteurs d'écran.
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
  const id = useId();
  const currentId = current?.id ?? "";
  const known = current === null || options.some((o) => o.id === current.id);

  // Valeur affichée : le choix, puis l'affectation relue (ajustée au rendu).
  const [value, setValue] = useState(currentId);
  const [seenCurrent, setSeenCurrent] = useState(currentId);
  if (seenCurrent !== currentId) {
    setSeenCurrent(currentId);
    setValue(currentId);
  }
  const [seenResult, setSeenResult] = useState(result);
  if (seenResult !== result) {
    setSeenResult(result);
    if (result.status === "error") setValue(currentId);
  }

  function assign(staffId: string) {
    setValue(staffId);
    const data = new FormData();
    data.set("orderId", orderId);
    data.set("role", role);
    // Précondition : si quelqu'un a changé l'affectation depuis l'affichage, rien n'est écrasé.
    data.set("expectedStaffId", currentId);
    data.set("staffId", staffId);
    startTransition(() => formAction(data));
  }

  const chosen = options.find((o) => o.id === value);
  const unavailable =
    chosen !== undefined && chosen.availability !== "disponible";
  const reason = chosen
    ? AVAILABILITY_LABELS[chosen.availability].toLowerCase()
    : "";

  return (
    <form
      aria-label={`Affectation : ${ASSIGNMENT_ROLE_LABELS[role]}`}
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-col gap-1"
    >
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
          value={value}
          disabled={pending}
          onChange={(event) => assign(event.target.value)}
          aria-describedby={unavailable ? `${id}-alerte` : undefined}
          className={cn(
            "w-full",
            value && "font-medium",
            unavailable && "border-destructive/60",
          )}
        >
          <NativeSelectOption value="">
            {value ? "— Retirer l'affectation" : "Non affecté"}
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
        {unavailable ? (
          <span
            id={`${id}-alerte`}
            data-slot="unavailable-warning"
            title={`Indisponible : ${reason}`}
            className="text-destructive flex shrink-0 items-center"
          >
            <TriangleAlert aria-hidden="true" className="warn-wiggle size-5" />
            <span className="sr-only">
              Attention : {chosen.name} est indisponible ({reason}).
            </span>
          </span>
        ) : null}
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
