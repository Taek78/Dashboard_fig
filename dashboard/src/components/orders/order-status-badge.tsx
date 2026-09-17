import type { ComponentProps } from "react";
import {
  Ban,
  PackageCheck,
  PackageOpen,
  Truck,
  type LucideIcon,
} from "lucide-react";
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
 * vert = livrée, rouge = annulée. Les mêmes tons et une icône par statut
 * servent à la liste déroulante du statut (OrderStatusSelect).
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

/** Icône de chaque statut : le colis ouvert à l'atelier, le camion, le colis remis, l'interdit. */
export const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  preparing: PackageOpen,
  delivering: Truck,
  delivered: PackageCheck,
  cancelled: Ban,
};

/** Pastille de l'icône à côté de la liste du statut : fond teinté, icône de la couleur. */
export const STATUS_ICON_TONE: Record<OrderStatus, string> = {
  preparing: "bg-warning/15 text-warning dark:bg-warning/20",
  delivering: "bg-info/12 text-info dark:bg-info/20",
  delivered: "bg-success/12 text-success dark:bg-success/20",
  cancelled: "bg-destructive/10 text-destructive dark:bg-destructive/20",
};

/**
 * La liste déroulante du statut prend la couleur du statut choisi (texte et
 * cadre du <select>, enfant direct de l'enveloppe de NativeSelect) ; le
 * libellé reste écrit.
 */
export const STATUS_SELECT_TONE: Record<OrderStatus, string> = {
  preparing:
    "text-warning [&>select]:border-warning/50 [&>select]:bg-warning/8",
  delivering: "text-info [&>select]:border-info/50 [&>select]:bg-info/8",
  delivered:
    "text-success [&>select]:border-success/50 [&>select]:bg-success/8",
  cancelled:
    "text-destructive [&>select]:border-destructive/50 [&>select]:bg-destructive/8",
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
