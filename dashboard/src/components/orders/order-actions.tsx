"use client";

import {
  Ban,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  PackageCheck,
} from "lucide-react";
import { useActionState, useState } from "react";
import { changeOrderStatus } from "@/app/(dashboard)/commandes/[id]/actions";
import { CancellationFields } from "@/components/orders/cancellation-fields";
import { Button } from "@/components/ui/button";
import {
  DELIVERY_STEP_LABELS,
  nextDeliveryStep,
} from "@/domain/deliveries/rules";
import { canTransition, type OrderStatus } from "@/domain/orders/status";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Actions d'une carte de commande ou de livraison (client : useActionState) :
 * UN gros bouton pour le geste suivant (préparer, démarrer, livrée)
 * et, tant que c'est permis, « Annuler la commande » qui ouvre le motif à
 * communiquer au client ; l'annulation ne part qu'avec ce motif. Même Server
 * Action que la fiche : la valeur du bouton cliqué devient nextStatus, l'action
 * revérifie rôle, transition et motif.
 */
export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [result, formAction, pending] = useActionState(
    changeOrderStatus,
    idleActionResult,
  );
  const [cancelling, setCancelling] = useState(false);
  const step = nextDeliveryStep(status);
  const canCancel = canTransition(status, "cancelled");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      {step && !cancelling ? (
        <Button
          type="submit"
          name="nextStatus"
          value={step}
          variant="brand"
          size="lg"
          disabled={pending}
          className="h-11 w-full"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <PackageCheck />
          )}
          {DELIVERY_STEP_LABELS[step]}
        </Button>
      ) : null}

      {canCancel && !cancelling ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive self-start"
          onClick={() => setCancelling(true)}
        >
          <Ban />
          {DELIVERY_STEP_LABELS.cancelled}
        </Button>
      ) : null}

      {canCancel && cancelling ? (
        <div
          role="group"
          aria-label="Annulation de la commande"
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-3"
        >
          <CancellationFields autoFocus />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="nextStatus"
              value="cancelled"
              variant="destructive"
              disabled={pending}
            >
              {pending ? <LoaderCircle className="animate-spin" /> : <Ban />}
              Confirmer l&apos;annulation
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setCancelling(false)}
            >
              Retour
            </Button>
          </div>
        </div>
      ) : null}

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
