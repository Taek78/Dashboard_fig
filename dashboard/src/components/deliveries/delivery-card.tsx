import Link from "next/link";
import { ArrowRight, MapPin, Navigation, Package, Phone } from "lucide-react";
import {
  CLIENT_TYPE_TINT,
  ClientTypeLabel,
} from "@/components/customers/client-type-label";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderDiscountBadge } from "@/components/orders/order-discount-badge";
import {
  OrderStatusBadge,
  STATUS_ACCENT,
} from "@/components/orders/order-status-badge";
import {
  OrderTeam,
  type AssignmentOptions,
} from "@/components/orders/order-team";
import { Button, buttonVariants } from "@/components/ui/button";
import { clientTypeOf } from "@/domain/customers/client-type";
import { itineraryUrl } from "@/domain/deliveries/rules";
import type { Order } from "@/domain/orders/types";
import { formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'une livraison (serveur), pensée pour le terrain autant que pour le
 * bureau. Trois bandes :
 *   1. l'ordre de passage (numéro), le créneau, le statut, la référence, le
 *      type de client (particulier ou communauté, en couleur, bande teintée) et
 *      la remise éventuelle ;
 *   2. le client, avec deux gestes en un tap : appeler, ouvrir l'itinéraire
 *      (de vrais <a> habillés en bouton : Base UI donnerait role="button" à un
 *      lien rendu par <Button>) ; puis l'adresse ou le point de retrait, le
 *      contenu et le montant, et la fiche ;
 *   3. le suivi : le livreur affecté (en premier, c'est la tournée) et le
 *      préparateur, puis le geste suivant et l'annulation avec motif
 *      (OrderActions, partagé avec les cartes de commandes).
 * Disposition selon la largeur de la zone de contenu (@container/main), comme
 * la carte de commande : empilées, puis bandeau + deux colonnes (@xl), puis
 * trois colonnes (@4xl).
 * La prochaine livraison à faire est mise en avant (anneau de couleur).
 * Aucun élément absolu : rien ne peut se chevaucher.
 */
export function DeliveryCard({
  order,
  position,
  isNext,
  canChangeStatus,
  canAssign,
  options,
}: {
  order: Order;
  /** Ordre de passage dans la tournée, à partir de 1. */
  position: number;
  /** Première livraison non terminée de la tournée. */
  isNext: boolean;
  canChangeStatus: boolean;
  canAssign: boolean;
  options: AssignmentOptions;
}) {
  const done = order.status === "delivered" || order.status === "cancelled";

  return (
    <article
      aria-label={`Livraison ${position}, ${order.reference}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift cv-auto grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border-l-4 shadow-sm ring-1 @xl/main:grid-cols-2 @4xl/main:grid-cols-[13rem_minmax(0,1fr)_20rem]",
        STATUS_ACCENT[order.status],
        isNext && "ring-primary ring-2",
        done && "opacity-80",
      )}
    >
      {/* 1. Ordre de passage, créneau et statut */}
      <div
        className={cn(
          "flex flex-row items-center gap-4 border-b p-4 @xl/main:col-span-2 @xl/main:p-5 @4xl/main:col-span-1 @4xl/main:flex-col @4xl/main:items-start @4xl/main:border-r @4xl/main:border-b-0",
          CLIENT_TYPE_TINT[clientTypeOf(order.community)],
        )}
      >
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
          <ClientTypeLabel community={order.community} className="mt-1" />
          <OrderDiscountBadge order={order} />
        </div>
      </div>

      {/* 2. Client et gestes rapides */}
      <div className="flex min-w-0 flex-col gap-3 p-4 @xl/main:p-5">
        <p className="truncate text-lg font-semibold">
          {order.customer.fullName}
        </p>
        <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:flex-wrap">
          {/* Téléphone vide : client anonymisé (RGPD). */}
          {order.customer.phone ? (
            <a
              href={toTelHref(order.customer.phone)}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "justify-start @xl/main:justify-center",
              )}
            >
              <Phone />
              {order.customer.phone}
            </a>
          ) : null}
          <a
            href={itineraryUrl(
              order.deliveryPostalCode,
              order.deliveryCity,
              order.deliveryAddressLine,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "justify-start @xl/main:justify-center",
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
            <span className="sr-only">
              {order.community ? "Point de retrait" : "Adresse"}
            </span>
          </dt>
          <dd>
            {order.community ? (
              <>
                <span className="font-medium">{order.community.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · retrait{" "}
                  {order.deliveryAddressLine
                    ? `${order.deliveryAddressLine}, `
                    : "à "}
                  {order.deliveryPostalCode} {order.deliveryCity}
                </span>
              </>
            ) : (
              <>
                {order.deliveryAddressLine
                  ? `${order.deliveryAddressLine}, `
                  : ""}
                {order.deliveryPostalCode} {order.deliveryCity}
              </>
            )}
          </dd>
          <dt className="text-muted-foreground">
            <Package className="size-4" aria-hidden="true" />
            <span className="sr-only">Contenu</span>
          </dt>
          <dd>
            {order.lines.length} article{order.lines.length > 1 ? "s" : ""} ·{" "}
            <span className="text-base font-bold tabular-nums">
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

      {/* 3. Suivi : équipe puis action de terrain */}
      <div className="flex min-w-0 flex-col justify-center gap-3 border-t p-4 @xl/main:border-t-0 @xl/main:border-l @xl/main:p-5">
        <OrderTeam
          order={order}
          options={options}
          canAssign={canAssign && !done}
          roles={["driver", "preparer"]}
        />
        <div className="border-t pt-3">
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
      </div>
    </article>
  );
}
