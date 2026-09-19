import { Lock } from "lucide-react";
import type { RefundKind } from "@/domain/orders/refund";

/*
 * À la place de la liste du statut (serveur) : une commande remboursée ou en
 * avoir RESTE annulée (règle de l'action et contrainte de la base). La phrase
 * dit pourquoi et comment la libérer, au lieu d'une liste qui échouerait.
 */
export function RefundLock({ kind }: { kind: RefundKind }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Statut verrouillé : {kind === "credit" ? "avoir" : "remboursée"}
      </span>
    </p>
  );
}
