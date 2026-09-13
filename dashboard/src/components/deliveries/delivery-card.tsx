import Link from "next/link";
import { ArrowRight, MapPin, Package, Phone, User } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderStatusForm } from "@/components/orders/order-status-form";
import { Button } from "@/components/ui/button";
import { allowedTransitions } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import { formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte horizontale d'une livraison (serveur). Trois bandes de gauche à droite
 * sur écran large, empilées sur mobile :
 *   1. le créneau (grand), le statut, la référence ;
 *   2. le client, l'adresse, le téléphone cliquable, les articles et le montant ;
 *   3. l'action : changer le statut (même Server Action que la fiche commande).
 * Aucun élément absolu : rien ne peut se chevaucher.
 */
export function DeliveryCard({
  order,
  canChangeStatus,
}: {
  order: Order;
  canChangeStatus: boolean;
}) {
  const allowed = allowedTransitions(order.status);
  const done = order.status === "delivered" || order.status === "cancelled";

  return (
    <article
      aria-label={`Livraison ${order.reference}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 md:flex-row",
        done && "opacity-80",
      )}
    >
      {/* 1. Créneau et statut */}
      <div className="bg-muted/40 flex flex-row items-center justify-between gap-3 border-b p-4 md:w-44 md:shrink-0 md:flex-col md:items-start md:justify-start md:border-r md:border-b-0 md:p-5">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Créneau</span>
          <span className="text-2xl font-semibold tabular-nums">
            {order.deliverySlot.start}
          </span>
          <span className="text-muted-foreground text-sm tabular-nums">
            → {order.deliverySlot.end}
          </span>
        </div>
        <div className="flex flex-col items-end gap-2 md:items-start">
          <OrderStatusBadge status={order.status} />
          <Link
            href={`/commandes/${order.id}`}
            className="text-muted-foreground font-mono text-xs underline-offset-4 hover:underline focus-visible:underline"
          >
            {order.reference}
          </Link>
        </div>
      </div>

      {/* 2. Client et contenu */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <p className="truncate text-lg font-semibold">
          {order.customer.fullName}
        </p>
        <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            <span className="sr-only">Adresse</span>
          </dt>
          <dd>
            {order.deliveryPostalCode} {order.deliveryCity}
          </dd>
          <dt className="text-muted-foreground">
            <Phone className="size-4" aria-hidden="true" />
            <span className="sr-only">Téléphone</span>
          </dt>
          <dd>
            <a
              href={toTelHref(order.customer.phone)}
              className="underline-offset-4 hover:underline"
            >
              {order.customer.phone}
            </a>
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

      {/* 3. Action */}
      <div className="flex flex-col gap-2 border-t p-4 md:w-72 md:shrink-0 md:border-t-0 md:border-l md:p-5">
        <h3 className="text-sm font-semibold">Statut de la livraison</h3>
        {allowed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Statut final : aucune transition possible.
          </p>
        ) : !canChangeStatus ? (
          <p className="text-muted-foreground text-sm">
            Compte en lecture seule.
          </p>
        ) : (
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            allowed={allowed}
          />
        )}
      </div>
    </article>
  );
}
