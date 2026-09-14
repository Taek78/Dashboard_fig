import Link from "next/link";
import { ArrowRight, MapPin, Navigation, Package, Phone } from "lucide-react";
import { OrderActions } from "@/components/orders/order-actions";
import {
  OrderStatusBadge,
  STATUS_ACCENT,
} from "@/components/orders/order-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { itineraryUrl } from "@/domain/deliveries/rules";
import type { Order } from "@/domain/orders/types";
import { formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'une livraison (serveur), pensée pour le terrain autant que pour le
 * bureau. Trois bandes de gauche à droite sur écran large, empilées sur mobile :
 *   1. l'ordre de passage (numéro), le créneau, le statut, la référence ;
 *   2. le client, avec deux gestes en un tap : appeler, ouvrir l'itinéraire
 *      (de vrais <a> habillés en bouton : Base UI donnerait role="button" à un
 *      lien rendu par <Button>) ; puis le contenu et le montant, et la fiche ;
 *   3. l'action de terrain : le geste suivant en un bouton, annulation avec
 *      motif (OrderActions, partagé avec les cartes de commandes).
 * La prochaine livraison à faire est mise en avant (anneau de couleur).
 * Aucun élément absolu : rien ne peut se chevaucher.
 */
export function DeliveryCard({
  order,
  position,
  isNext,
  canChangeStatus,
}: {
  order: Order;
  /** Ordre de passage dans la tournée, à partir de 1. */
  position: number;
  /** Première livraison non terminée de la tournée. */
  isNext: boolean;
  canChangeStatus: boolean;
}) {
  const done = order.status === "delivered" || order.status === "cancelled";

  return (
    <article
      aria-label={`Livraison ${position}, ${order.reference}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift flex flex-col overflow-hidden rounded-2xl border-l-4 shadow-sm ring-1 md:flex-row",
        STATUS_ACCENT[order.status],
        isNext && "ring-primary ring-2",
        done && "opacity-70",
      )}
    >
      {/* 1. Ordre de passage, créneau et statut */}
      <div className="bg-muted/40 flex flex-row items-center gap-4 border-b p-4 md:w-48 md:shrink-0 md:flex-col md:items-start md:border-r md:border-b-0 md:p-5">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums",
            isNext
              ? "bg-gradient-brand text-white shadow-sm"
              : "bg-card ring-foreground/10 ring-1",
          )}
        >
          {position}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {isNext ? (
            <span className="text-primary text-xs font-semibold tracking-wide uppercase">
              Prochaine
            </span>
          ) : null}
          <span className="text-2xl leading-none font-semibold tabular-nums">
            {order.deliverySlot.start}
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              → {order.deliverySlot.end}
            </span>
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Link
              href={`/commandes/${order.id}`}
              className="text-muted-foreground font-mono text-xs underline-offset-4 hover:underline focus-visible:underline"
            >
              {order.reference}
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Client et gestes rapides */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:p-5">
        <p className="truncate text-lg font-semibold">
          {order.customer.fullName}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={toTelHref(order.customer.phone)}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "justify-start sm:justify-center",
            )}
          >
            <Phone />
            {order.customer.phone}
          </a>
          <a
            href={itineraryUrl(order.deliveryPostalCode, order.deliveryCity)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "justify-start sm:justify-center",
            )}
          >
            <Navigation />
            Itinéraire
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </div>
        <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
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

      {/* 3. Action de terrain */}
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
