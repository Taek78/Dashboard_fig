"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { changeOrderStatus } from "@/app/(dashboard)/commandes/[id]/actions";
import { CancellationFields } from "@/components/orders/cancellation-fields";
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
 * Formulaire de changement de statut de la fiche commande (client :
 * useActionState). Il n'importe jamais @/data/* : il part dans le navigateur.
 *
 * - `allowed` vient de la page (règle pure côté serveur) : le client ne décide
 *   jamais des options, et l'action les recalcule de toute façon.
 * - Option vide + required : sans elle, le premier statut serait présélectionné et
 *   un clic réflexe changerait la commande.
 * - key={currentStatus} sur le SELECT : après un succès la page se re-rend avec un
 *   nouveau statut, la key remet « Choisir un statut » sans remonter le hook.
 * - Choisir « Annulée » fait apparaître le motif à communiquer au client
 *   (CancellationFields) : c'est la confirmation, exigée aussi par l'action.
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
  const [cancelling, setCancelling] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="grid gap-1.5">
        <Label htmlFor="nextStatus">Nouveau statut</Label>
        <NativeSelect
          key={currentStatus}
          id="nextStatus"
          name="nextStatus"
          required
          defaultValue=""
          onChange={(e) => setCancelling(e.target.value === "cancelled")}
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

      {cancelling ? (
        <div
          role="group"
          aria-label="Annulation de la commande"
          className="border-destructive/40 bg-destructive/5 rounded-xl border p-3"
        >
          <CancellationFields />
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        variant={cancelling ? "destructive" : "default"}
        className="w-full @xl/main:w-auto @xl/main:self-start"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Enregistrement…
          </>
        ) : cancelling ? (
          "Confirmer l'annulation"
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
