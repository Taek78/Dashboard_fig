"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { saveProduct } from "@/app/(dashboard)/catalogue/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/*
 * Fiche produit éditable (client : useActionState). Le prix se saisit en euros,
 * la conversion en centimes est faite par zod côté serveur ; le stock en unité de
 * base (g ou pièces). Champs non contrôlés : après un succès, ce qui est affiché
 * est ce qui vient d'être enregistré, aucune remise à zéro nécessaire.
 */
type ProductFormProps = {
  productId: string;
  priceEurosDefault: string;
  availableDefault: boolean;
  stockDefault: number;
  unitLabel: string;
};

export function ProductForm({
  productId,
  priceEurosDefault,
  availableDefault,
  stockDefault,
  unitLabel,
}: ProductFormProps) {
  const [result, formAction, pending] = useActionState(
    saveProduct,
    idleActionResult,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />

      <div className="grid gap-1.5">
        <Label htmlFor="priceEuros">Prix (€ {unitLabel})</Label>
        <Input
          id="priceEuros"
          name="priceEuros"
          inputMode="decimal"
          required
          defaultValue={priceEurosDefault}
          className="max-w-40"
          aria-describedby="priceEuros-help"
        />
        <p id="priceEuros-help" className="text-muted-foreground text-xs">
          En euros, deux décimales maximum, ex. 3,50.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="stockQuantity">
          Stock ({unitLabel === "le kg" ? "grammes" : "pièces"})
        </Label>
        <Input
          id="stockQuantity"
          name="stockQuantity"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={stockDefault}
          className="max-w-40"
        />
      </div>

      <Label htmlFor="available" className="cursor-pointer">
        <input
          id="available"
          name="available"
          type="checkbox"
          defaultChecked={availableDefault}
          className="accent-primary size-4"
        />
        Disponible à la vente dans l&apos;application
      </Label>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Enregistrement…
          </>
        ) : (
          "Enregistrer"
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
