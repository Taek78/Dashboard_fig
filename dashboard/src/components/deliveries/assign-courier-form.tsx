"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { assignCourier } from "@/app/(dashboard)/livraisons/actions";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire d'attribution d'une ligne de la tournée (client : useActionState).
 * Une instance par commande attribuable ; la liste des livreurs vient du serveur.
 * Le libellé du select est porté par aria-label : le tableau n'a pas la place
 * d'un <Label> visible et l'en-tête de colonne « Livreur » dit déjà le contexte.
 */
type AssignCourierFormProps = {
  orderId: string;
  orderReference: string;
  couriers: { id: string; name: string }[];
  currentCourierId: string | null;
};

export function AssignCourierForm({
  orderId,
  orderReference,
  couriers,
  currentCourierId,
}: AssignCourierFormProps) {
  const [result, formAction, pending] = useActionState(
    assignCourier,
    idleActionResult,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex items-center gap-2">
        <NativeSelect
          key={currentCourierId ?? ""}
          name="courierId"
          required
          defaultValue={currentCourierId ?? ""}
          aria-label={`Livreur de la commande ${orderReference}`}
          size="sm"
          className="min-w-40"
        >
          <NativeSelectOption value="" disabled>
            Choisir un livreur
          </NativeSelectOption>
          {couriers.map((courier) => (
            <NativeSelectOption key={courier.id} value={courier.id}>
              {courier.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Enregistrement…
            </>
          ) : currentCourierId ? (
            "Modifier"
          ) : (
            "Attribuer"
          )}
        </Button>
      </div>
      <p
        role="status"
        className={cn(
          "flex items-center gap-1 text-xs",
          result.status === "success" && "text-success",
          result.status === "error" && "text-destructive",
        )}
      >
        {result.status === "success" ? (
          <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
        ) : null}
        {result.status === "error" ? (
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        ) : null}
        {result.status === "idle" ? null : result.message}
      </p>
    </form>
  );
}
