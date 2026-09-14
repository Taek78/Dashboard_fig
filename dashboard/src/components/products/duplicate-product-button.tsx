"use client";

import { Copy, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { duplicateProduct } from "@/app/(dashboard)/catalogue/actions";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/action-result";

/*
 * Duplication d'un produit (client : useActionState). Un clic crée une copie
 * masquée nommée « … (copie) » et redirige vers sa fiche ; la copie ne part
 * dans l'application qu'une fois relue et rendue visible. Seule une erreur
 * s'affiche ici : le succès est la redirection.
 */
export function DuplicateProductButton({
  productId,
  size = "default",
  iconOnly = false,
}: {
  productId: string;
  size?: "default" | "sm" | "icon-sm";
  /** Sur une carte : l'icône seule, le libellé pour les lecteurs d'écran et l'infobulle. */
  iconOnly?: boolean;
}) {
  const [result, formAction, pending] = useActionState(
    duplicateProduct,
    idleActionResult,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="productId" value={productId} />
      <Button
        type="submit"
        variant={iconOnly ? "ghost" : "outline"}
        size={size}
        disabled={pending}
        title={iconOnly ? "Dupliquer" : undefined}
        aria-label={iconOnly ? "Dupliquer" : undefined}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Copy />}
        {iconOnly ? null : "Dupliquer ce produit"}
      </Button>
      {result.status === "error" ? (
        <p role="status" className="text-destructive w-full text-xs">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
