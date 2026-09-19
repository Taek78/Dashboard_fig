"use client";

import { HandCoins, LoaderCircle, TicketPercent, Undo2 } from "lucide-react";
import { useActionState, useId } from "react";
import { recordOrderRefund } from "@/app/(dashboard)/commandes/[id]/actions";
import { ActionStatus } from "@/components/action-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REFUND_KIND_LABELS, type OrderRefund } from "@/domain/orders/refund";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Remboursement ou avoir d'une commande ANNULÉE (demande du 2026-09-19),
 * fiche de la commande, admin et gestionnaire (l'action revérifie) :
 * - sans remboursement : « Remboursement » ou « Avoir » (deux grandes
 *   pastilles radio, cuivre et sarcelle), le montant en euros prérempli avec
 *   le total (partiel permis, jamais au-dessus), « Enregistrer » ;
 * - avec : « Retirer » (erreur de saisie) ; la commande pourra de nouveau
 *   changer de statut.
 * Le montant n'est pas vérifié ici : l'action le compare au total RELU.
 */
const KINDS = [
  {
    key: "refund",
    Icon: HandCoins,
    tone: "has-checked:border-refund has-checked:bg-refund/12 has-checked:text-refund",
  },
  {
    key: "credit",
    Icon: TicketPercent,
    tone: "has-checked:border-credit has-checked:bg-credit/12 has-checked:text-credit",
  },
] as const;

export function RefundForm({
  orderId,
  refund,
  totalInput,
}: {
  orderId: string;
  refund: OrderRefund | null;
  /** Le total de la commande au format de saisie (« 24,90 »). */
  totalInput: string;
}) {
  const [result, formAction, pending] = useActionState(
    recordOrderRefund,
    idleActionResult,
  );
  const amountId = useId();

  if (refund) {
    return (
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="intent" value="retirer" />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="w-full @xl/main:w-auto @xl/main:self-start"
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Undo2 />}
          {refund.kind === "credit"
            ? "Retirer l'avoir"
            : "Retirer le remboursement"}
        </Button>
        <ActionStatus result={result} />
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="intent" value="enregistrer" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map(({ key, Icon, tone }) => (
            <label
              key={key}
              className={cn(
                "border-input hover:bg-muted/40 has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium select-none has-focus-visible:ring-3 motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-in-out",
                tone,
              )}
            >
              <input
                type="radio"
                name="kind"
                value={key}
                required
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden="true" />
              {REFUND_KIND_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={amountId}>Montant (€)</Label>
        <Input
          id={amountId}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={totalInput}
          aria-describedby={`${amountId}-aide`}
          className="tabular-nums"
        />
        <p id={`${amountId}-aide`} className="text-muted-foreground text-xs">
          Total ou partiel, au plus {totalInput} €.
        </p>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="w-full @xl/main:w-auto @xl/main:self-start"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
      <ActionStatus result={result} />
    </form>
  );
}
