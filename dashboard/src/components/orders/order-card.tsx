import {
  ArrowRight,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
} from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { OrderStatusSelect } from "@/components/orders/order-status-select";
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
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { itineraryUrl } from "@/domain/deliveries/rules";
import { formatCancellation } from "@/domain/orders/cancellation";
import { orderKindOf } from "@/domain/orders/rules";
import type { Order } from "@/domain/orders/types";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'une commande (serveur), pensée pour le bureau ET le terrain depuis
 * que la section Livraisons y a été fondue (2026-09-16). Trois bandes :
 *   1. le jour et le CRÉNEAU EN GRAND (c'est ce qu'on cherche des yeux en
 *      tournée), la référence, le TYPE de commande (particulier ou
 *      communauté : badge en couleur, et la bande est teintée de même), le
 *      statut (et le motif si annulée), la remise éventuelle ;
 *   2. le client : pour une commande de communauté, le NOM DE LA COMMUNAUTÉ
 *      (lien vers sa fiche) et, dessous, l'interlocuteur à qui tout est livré
 *      (la personne qui a commandé, garante, lien vers sa fiche) ; pour un
 *      particulier, son nom. Puis deux gestes en un tap : appeler, ouvrir
 *      l'itinéraire (de vrais <a> habillés en bouton : Base UI donnerait
 *      role="button" à un lien rendu par <Button>) ; l'adresse ou le point de
 *      retrait, le contenu et le montant (avec la remise entre parenthèses ;
 *      les frais de livraison sont dans le détail seulement), l'e-mail, le
 *      lien vers le détail ;
 *   3. le suivi : l'équipe (préparateur, livreur, en listes déroulantes qui
 *      écrivent aussitôt), puis la liste du statut (icône et couleur du
 *      statut choisi, écrit dès le choix ; « Annulée » demande d'abord le
 *      motif ; tout statut est atteignable depuis n'importe quel autre).
 * Disposition selon la largeur de la ZONE DE CONTENU (@container/main du
 * layout), pas de la fenêtre : empilées quand la page est étroite (mobile,
 * tablette sidebar ouverte), bande 1 en bandeau et bandes 2 et 3 côte à côte
 * dès @xl, trois colonnes dès @4xl.
 * Aucun élément absolu : rien ne peut se chevaucher.
 */
const KIND_BAND = {
  particulier: "bg-individual/8",
  communaute: "bg-community/10",
} as const;

export function OrderCard({
  order,
  canChangeStatus,
  canAssign,
  options,
}: {
  order: Order;
  canChangeStatus: boolean;
  canAssign: boolean;
  options: AssignmentOptions;
}) {
  const done = order.status === "delivered" || order.status === "cancelled";
  const kind = orderKindOf(order);
  const community = order.community;

  return (
    <article
      aria-label={`Commande ${order.reference}, ${
        community
          ? `${community.name} (interlocuteur ${order.customer.fullName})`
          : order.customer.fullName
      }`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift cv-auto grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border-l-4 shadow-sm ring-1 @xl/main:grid-cols-2 @4xl/main:grid-cols-[14rem_minmax(0,1fr)_20rem]",
        STATUS_ACCENT[order.status],
        done && "opacity-80",
      )}
    >
      {/* 1. Créneau en grand, référence, type, statut, remise */}
      <div
        className={cn(
          "flex flex-row items-start justify-between gap-3 border-b p-4 @xl/main:col-span-2 @xl/main:p-5 @4xl/main:col-span-1 @4xl/main:flex-col @4xl/main:justify-start @4xl/main:border-r @4xl/main:border-b-0",
          KIND_BAND[kind],
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium first-letter:uppercase">
            {formatDateFr(order.deliverySlot.date)}
          </span>
          <span className="text-2xl leading-none font-semibold tabular-nums">
            <span className="sr-only">Créneau </span>
            {order.deliverySlot.start}
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              → {order.deliverySlot.end}
            </span>
          </span>
          <HoverPrefetchLink
            href={`/commandes/${order.id}`}
            className="text-muted-foreground mt-1 font-mono text-xs font-semibold underline-offset-4 hover:underline focus-visible:underline"
          >
            {order.reference}
          </HoverPrefetchLink>
          <ClientTypeLabel type={kind} className="mt-1 w-fit" />
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5 @4xl/main:items-start">
          <OrderStatusBadge status={order.status} />
          <OrderDiscountBadge order={order} />
          {order.cancellation ? (
            <span className="text-muted-foreground text-xs">
              {formatCancellation(order.cancellation)}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Client (communauté et interlocuteur, ou particulier), gestes rapides et contenu */}
      <div className="flex min-w-0 flex-col gap-3 p-4 @xl/main:p-5">
        {community ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-lg font-semibold">
              <HoverPrefetchLink
                href={`/clients/communautes/${community.id}`}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {community.name}
              </HoverPrefetchLink>
            </p>
            <p className="text-muted-foreground truncate text-sm">
              Interlocuteur :{" "}
              <HoverPrefetchLink
                href={`/clients/${order.customer.id}`}
                className="text-foreground font-medium underline-offset-4 hover:underline focus-visible:underline"
              >
                {order.customer.fullName}
              </HoverPrefetchLink>
            </p>
          </div>
        ) : (
          <p className="truncate text-lg font-semibold">
            <HoverPrefetchLink
              href={`/clients/${order.customer.id}`}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {order.customer.fullName}
            </HoverPrefetchLink>
          </p>
        )}
        <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:flex-wrap">
          {/* Téléphone vide : client anonymisé (RGPD). */}
          {order.customer.phone ? (
            <a
              href={toTelHref(order.customer.phone)}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "justify-start tabular-nums @xl/main:justify-center",
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
              {community ? "Point de retrait" : "Adresse"}
            </span>
          </dt>
          <dd>
            {community ? (
              <>
                <span className="text-muted-foreground">Retrait : </span>
                {order.deliveryAddressLine
                  ? `${order.deliveryAddressLine}, `
                  : ""}
                {order.deliveryPostalCode} {order.deliveryCity}
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
            {/* La remise seule ; frais de livraison et sous-total restent dans le détail. */}
            {order.discount ? (
              <span className="text-muted-foreground tabular-nums">
                {" "}
                (remise −{formatEuros(order.discount.amountCents)})
              </span>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">
            <Mail className="size-4" aria-hidden="true" />
            <span className="sr-only">E-mail</span>
          </dt>
          <dd className="truncate">{order.customer.email}</dd>
        </dl>
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            render={<HoverPrefetchLink href={`/commandes/${order.id}`} />}
          >
            Détail de la commande
            <ArrowRight />
          </Button>
        </div>
      </div>

      {/* 3. Suivi : équipe puis actions */}
      <div className="flex min-w-0 flex-col justify-center gap-3 border-t p-4 @xl/main:border-t-0 @xl/main:border-l @xl/main:p-5">
        <OrderTeam
          order={order}
          options={options}
          canAssign={canAssign && !done}
        />
        <div className="border-t pt-3">
          {canChangeStatus ? (
            <OrderStatusSelect
              orderId={order.id}
              status={order.status}
              notifyAllowed={order.customer.notifyOrderStatus}
              wasDelivered={order.wasDelivered}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Compte en lecture seule.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
