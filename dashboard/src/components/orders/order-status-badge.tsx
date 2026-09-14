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
 * Lecture des couleurs : ambre = à traiter, mauve = en cours, vert = terminé,
 * rouge = à ne pas préparer, neutre = validé en attente de préparation.
 */
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const VARIANT_BY_STATUS: Record<OrderStatus, BadgeVariant> = {
  pending: "warning", // pas encore pris en charge : demande une action
  confirmed: "outline", // validée, en file
  preparing: "default", // en cours, le plus visible (mauve plein)
  delivering: "secondary", // en cours, mauve doux
  delivered: "success", // terminée
  cancelled: "destructive", // à ne pas préparer
};

/** Couleur d'accent d'une carte (bordure gauche) selon le statut ; tokens seulement. */
export const STATUS_ACCENT: Record<OrderStatus, string> = {
  pending: "border-l-warning",
  confirmed: "border-l-primary",
  preparing: "border-l-primary",
  delivering: "border-l-info",
  delivered: "border-l-success",
  cancelled: "border-l-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
      />
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
