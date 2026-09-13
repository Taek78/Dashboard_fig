"use client";

import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { removeProduct } from "@/app/(dashboard)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DELETE_CONFIRM_WORD } from "@/domain/products/schemas";
import { idleActionResult } from "@/lib/action-result";

/*
 * Suppression définitive en deux temps (client) : un premier clic ouvre un
 * encart d'avertissement ; il faut taper SUPPRIMER pour activer le bouton rouge.
 * Le mot est aussi exigé par zod côté serveur : impossible de supprimer par un
 * POST forgé sans lui. Aucune boîte de dialogue native : l'encart reste dans la
 * page, lisible par un lecteur d'écran (role="alert").
 */
export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, formAction, pending] = useActionState(
    removeProduct,
    idleActionResult,
  );
  const inputId = useId();
  const ready = typed.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Supprimer ce produit
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>Suppression définitive de « {productName} ».</strong> Le
          produit disparaît du catalogue et de l&apos;application. Les commandes
          passées gardent leurs lignes. Pour le retirer sans le perdre, décochez
          plutôt « Visible dans l&apos;application ».
        </span>
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={inputId}>
          Tapez <span className="font-mono">{DELETE_CONFIRM_WORD}</span> pour
          confirmer
        </Label>
        <Input
          id={inputId}
          name="confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="max-w-56"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={!ready || pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Suppression…
            </>
          ) : (
            <>
              <Trash2 />
              Supprimer définitivement
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
        >
          Annuler
        </Button>
      </div>
      {result.status === "error" ? (
        <p role="status" className="text-destructive text-sm">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
