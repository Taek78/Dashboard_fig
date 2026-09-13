"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { type FormEvent, useActionState } from "react";
import { changeOrderStatus } from "@/app/(dashboard)/commandes/[id]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/status";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Formulaire de changement de statut. Seul nouveau fichier "use client" de A2,
 * imposé par useActionState (hook). Il n'importe jamais @/data/* : il part dans le
 * navigateur.
 *
 * - `allowed` vient de la page (règle pure côté serveur) : le client ne décide
 *   jamais des options, et l'action les recalcule de toute façon.
 * - Option vide + required : sans elle, le premier statut serait présélectionné et
 *   un clic réflexe changerait la commande.
 * - key={currentStatus} sur le SELECT, pas sur le form : après un succès la page se
 *   re-rend avec un nouveau statut, la key remet « Choisir un statut » sans
 *   remonter le hook (le message resterait effacé sinon).
 * - La région role="status" est rendue dès le premier rendu, même vide : un lecteur
 *   d'écran n'annonce que les changements d'une région live déjà dans le DOM.
 */
type OrderStatusFormProps = {
  orderId: string;
  currentStatus: OrderStatus;
  allowed: OrderStatus[];
};

export function OrderStatusForm({
  orderId,
  currentStatus,
  allowed,
}: OrderStatusFormProps) {
  const [result, formAction, pending] = useActionState(
    changeOrderStatus,
    idleActionResult,
  );

  // Annuler est destructif : confirmation avant l'envoi.
  function confirmIfCancelling(event: FormEvent<HTMLFormElement>) {
    const next = new FormData(event.currentTarget).get("nextStatus");
    if (
      next === "cancelled" &&
      !window.confirm("Annuler cette commande ? Le client ne sera pas livré.")
    ) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={confirmIfCancelling}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="orderId" value={orderId} />

      <div className="grid gap-1.5">
        <Label htmlFor="nextStatus">Nouveau statut</Label>
        <NativeSelect
          key={currentStatus}
          id="nextStatus"
          name="nextStatus"
          required
          defaultValue=""
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            Choisir un statut
          </NativeSelectOption>
          {allowed.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto sm:self-start"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Enregistrement…
          </>
        ) : (
          "Changer le statut"
        )}
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
    </form>
  );
}
