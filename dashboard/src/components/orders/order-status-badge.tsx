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
 *
 * Lecture des couleurs : ambre = à l'atelier, couleur de marque = expédiée,
 * vert = livrée, rouge = annulée.
 */
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const VARIANT_BY_STATUS: Record<OrderStatus, BadgeVariant> = {
  preparing: "warning", // à l'atelier : le travail qui reste à faire
  delivering: "default", // expédiée : en route, couleur pleine
  delivered: "success", // terminée
  cancelled: "destructive", // à ne pas livrer
};

/** Couleur d'accent d'une carte (bordure gauche) selon le statut ; tokens seulement. */
export const STATUS_ACCENT: Record<OrderStatus, string> = {
  preparing: "border-l-warning",
  delivering: "border-l-info",
  delivered: "border-l-success",
  cancelled: "border-l-destructive",
};

/**
 * Plus grand que les autres badges (hauteur 28 px, texte 14 px en gras, liseré
 * de sa couleur) : le statut est l'information qu'on cherche d'un coup d'œil
 * sur une carte de commande ou de livraison.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant={VARIANT_BY_STATUS[status]}
      className="h-7 gap-1.5 px-3 text-sm font-semibold ring-1 ring-current/25"
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-current"
      />
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
