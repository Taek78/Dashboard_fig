import Link from "next/link";
import { ArrowRight, MapPin, Package, Phone, User } from "lucide-react";
import { OrderActions } from "@/components/orders/order-actions";
import {
  OrderStatusBadge,
  STATUS_ACCENT,
} from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { formatCancellation } from "@/domain/orders/cancellation";
import type { Order } from "@/domain/orders/types";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'une commande (serveur), même silhouette que la carte de livraison :
 *   1. la référence, le jour et le créneau, le statut (et le motif si annulée) ;
 *   2. le client (fiche, téléphone), la ville, le contenu et le montant, le
 *      lien vers le détail ;
 *   3. les actions : geste suivant en un bouton, annulation avec motif.
 * Aucun élément absolu : rien ne peut se chevaucher.
 */
export function OrderCard({
  order,
  canChangeStatus,
}: {
  order: Order;
  canChangeStatus: boolean;
}) {
  const done = order.status === "delivered" || order.status === "cancelled";

  return (
    <article
      aria-label={`Commande ${order.reference}, ${order.customer.fullName}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift flex flex-col overflow-hidden rounded-2xl border-l-4 shadow-sm ring-1 md:flex-row",
        STATUS_ACCENT[order.status],
        done && "opacity-70",
      )}
    >
      {/* 1. Référence, créneau, statut */}
      <div className="bg-muted/40 flex flex-row items-center justify-between gap-3 border-b p-4 md:w-52 md:shrink-0 md:flex-col md:items-start md:justify-start md:border-r md:border-b-0 md:p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/commandes/${order.id}`}
            className="font-mono text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline"
          >
            {order.reference}
          </Link>
          <span className="text-sm">
            {formatDateFr(order.deliverySlot.date)}
          </span>
          <span className="text-muted-foreground text-sm tabular-nums">
            {order.deliverySlot.start} → {order.deliverySlot.end}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 md:items-start">
          <OrderStatusBadge status={order.status} />
          {order.cancellation ? (
            <span className="text-muted-foreground text-xs">
              {formatCancellation(order.cancellation)}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Client et contenu */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <p className="truncate text-lg font-semibold">
          <Link
            href={`/clients/${order.customer.id}`}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            {order.customer.fullName}
          </Link>
        </p>
        <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">
            <Phone className="size-4" aria-hidden="true" />
            <span className="sr-only">Téléphone</span>
          </dt>
          <dd>
            <a
              href={toTelHref(order.customer.phone)}
              className="tabular-nums underline-offset-4 hover:underline"
            >
              {order.customer.phone}
            </a>
          </dd>
          <dt className="text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            <span className="sr-only">Adresse</span>
          </dt>
          <dd>
            {order.deliveryPostalCode} {order.deliveryCity}
          </dd>
          <dt className="text-muted-foreground">
            <Package className="size-4" aria-hidden="true" />
            <span className="sr-only">Contenu</span>
          </dt>
          <dd>
            {order.lines.length} article{order.lines.length > 1 ? "s" : ""} ·{" "}
            <span className="font-medium tabular-nums">
              {formatEuros(order.totalCents)}
            </span>
          </dd>
          <dt className="text-muted-foreground">
            <User className="size-4" aria-hidden="true" />
            <span className="sr-only">Contact</span>
          </dt>
          <dd className="truncate">{order.customer.email}</dd>
        </dl>
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            render={<Link href={`/commandes/${order.id}`} />}
          >
            Détail de la commande
            <ArrowRight />
          </Button>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="flex flex-col justify-center gap-2 border-t p-4 md:w-72 md:shrink-0 md:border-t-0 md:border-l md:p-5">
        {done ? (
          <p className="text-muted-foreground text-sm">
            Terminée : {order.status === "delivered" ? "livrée" : "annulée"}.
          </p>
        ) : !canChangeStatus ? (
          <p className="text-muted-foreground text-sm">
            Compte en lecture seule.
          </p>
        ) : (
          <OrderActions orderId={order.id} status={order.status} />
        )}
      </div>
    </article>
  );
}
