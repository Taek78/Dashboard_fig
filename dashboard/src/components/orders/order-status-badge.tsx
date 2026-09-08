import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/status";

/*
 * Badge d'un statut de commande. Composant serveur.
 *
 * La table statut → variante vit ICI et non dans src/domain/orders/status.ts :
 * le domaine ne connaît pas l'interface (il n'importe jamais un composant), c'est
 * l'interface qui traduit le domaine en couleurs. Record<OrderStatus, …> fait
 * refuser par tsc tout statut oublié le jour où la liste change.
 * Le libellé est toujours affiché : la couleur n'est jamais le seul signal.
 */
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const VARIANT_BY_STATUS: Record<OrderStatus, BadgeVariant> = {
  pending: "outline", // pas encore pris en charge
  confirmed: "secondary", // validée, en file
  preparing: "default", // en cours : le plus visible
  delivering: "default", // en cours
  delivered: "outline", // terminée, atténuée ci-dessous
  cancelled: "destructive", // à ne pas préparer
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant={VARIANT_BY_STATUS[status]}
      className={status === "delivered" ? "text-muted-foreground" : undefined}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
