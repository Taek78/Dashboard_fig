import { Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/domain/orders/types";

/*
 * Badge de la remise appliquée par l'application (serveur) : le nom de la
 * communauté et son pourcentage, ou la fidélité. Rien si la commande n'a pas
 * de remise. Le libellé porte l'information : la couleur n'est jamais seule.
 */
export function OrderDiscountBadge({ order }: { order: Order }) {
  if (!order.discount) return null;
  if (order.discount.kind === "community") {
    return (
      <Badge variant="secondary" className="max-w-full">
        <Users aria-hidden="true" />
        <span className="truncate">
          {order.community?.name ?? "Communauté"} · −{order.discount.percent} %
        </span>
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <Sparkles aria-hidden="true" />
      Fidélité · −{order.discount.percent} %
    </Badge>
  );
}
