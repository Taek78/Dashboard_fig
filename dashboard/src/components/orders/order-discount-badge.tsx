import { Percent, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/domain/orders/types";

/*
 * Badge de la remise appliquée par l'application FIG au paiement (serveur) :
 * remise de communauté ou fidélité, avec son pourcentage. Rien si la commande
 * n'a pas de remise. Le nom de la communauté est porté par CustomerTypeLabels :
 * le badge reste court, et passe à la ligne plutôt que de déborder.
 */
const wrap = "h-auto max-w-full whitespace-normal text-left";

export function OrderDiscountBadge({ order }: { order: Order }) {
  if (!order.discount) return null;
  const percent = `−${order.discount.percent} %`;
  return order.discount.kind === "community" ? (
    <Badge variant="secondary" className={wrap}>
      <Percent aria-hidden="true" />
      Remise communauté {percent}
    </Badge>
  ) : (
    <Badge variant="success" className={wrap}>
      <Sparkles aria-hidden="true" />
      Fidélité {percent}
    </Badge>
  );
}
