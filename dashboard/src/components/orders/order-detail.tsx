import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { OrderDiscountBadge } from "@/components/orders/order-discount-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderStatusForm } from "@/components/orders/order-status-form";
import {
  OrderTeam,
  type AssignmentOptions,
} from "@/components/orders/order-team";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  allowedTransitions,
  ORDER_STATUS_LABELS,
} from "@/domain/orders/status";
import { formatCancellation } from "@/domain/orders/cancellation";
import { formatDiscount } from "@/domain/orders/discount";
import type { Order, OrderEvent } from "@/domain/orders/types";
import Link from "next/link";
import {
  formatDateFr,
  formatDateTimeFr,
  formatEuros,
  formatQuantity,
  toTelHref,
} from "@/lib/format";

/*
 * Détail d'une commande. Composant serveur : il reçoit une Order déjà chargée par
 * la page et l'affiche en cinq cartes (Client, Livraison, Statut, Équipe,
 * Articles avec la remise éventuelle).
 *
 * - Grille lg (pas md) : à 768 px avec la sidebar dépliée, trois colonnes seraient
 *   trop étroites. Ordre DOM = ordre visuel pour les lecteurs d'écran.
 * - Un seul h1 (PageHeader) ; chaque carte porte un h2.
 * - `allowed` est calculé ICI, côté serveur, par la règle pure : le formulaire
 *   client ne propose que ces options, et l'action les recalcule de toute façon.
 * - <dl> : « libellé → valeur » pour un lecteur d'écran, sans tableau.
 * - Historique : les événements de statut, du plus récent au plus
 *   ancien, sous le formulaire de la carte Statut : qui, quand, quel passage.
 */
export function OrderDetail({
  order,
  events,
  canEdit,
  canAssign,
  options,
}: {
  order: Order;
  /** Historique des changements de statut, du plus récent au plus ancien. */
  events: OrderEvent[];
  /** Rôle autorisé à changer le statut. Confort d'affichage : l'action revérifie. */
  canEdit: boolean;
  /** Rôle autorisé à affecter l'équipe. */
  canAssign: boolean;
  options: AssignmentOptions;
}) {
  const allowed = allowedTransitions(order.status);
  const done = order.status === "delivered" || order.status === "cancelled";
  const subtotal = order.totalCents + (order.discount?.amountCents ?? 0);

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Client</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nom</dt>
            <dd className="font-medium">{order.customer.fullName}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>
              <ClientTypeLabel community={order.community} />
            </dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium break-all">
              <a
                href={`mailto:${order.customer.email}`}
                className="underline-offset-4 hover:underline"
              >
                {order.customer.email}
              </a>
            </dd>
            <dt className="text-muted-foreground">Téléphone</dt>
            <dd className="font-medium">
              <a
                href={toTelHref(order.customer.phone)}
                className="underline-offset-4 hover:underline"
              >
                {order.customer.phone}
              </a>
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Livraison</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium">
              {formatDateFr(order.deliverySlot.date)}
            </dd>
            <dt className="text-muted-foreground">Créneau</dt>
            <dd className="font-medium tabular-nums">
              {order.deliverySlot.start}–{order.deliverySlot.end}
            </dd>
            <dt className="text-muted-foreground">
              {order.community ? "Point de retrait" : "Adresse"}
            </dt>
            <dd className="font-medium">
              {order.community ? `${order.community.name}, ` : ""}
              {order.deliveryPostalCode} {order.deliveryCity}
            </dd>
            {order.community ? (
              <>
                <dt className="text-muted-foreground">Communauté</dt>
                <dd>
                  <Link
                    href={`/clients/communautes/${order.community.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {order.community.name}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card className="@4xl/main:row-span-2">
        <CardHeader>
          <CardTitle>
            <h2>Statut</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-1.5">
              <OrderStatusBadge status={order.status} />
              <OrderDiscountBadge order={order} />
            </div>
            {order.cancellation ? (
              <p className="text-sm">
                Motif communiqué au client :{" "}
                <span className="font-medium">
                  {formatCancellation(order.cancellation)}
                </span>
              </p>
            ) : null}
          </div>
          {allowed.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Statut final : aucune transition possible.
            </p>
          ) : !canEdit ? (
            <p className="text-muted-foreground text-sm">
              Votre compte est en lecture seule : le statut ne peut pas être
              modifié.
            </p>
          ) : (
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              allowed={allowed}
            />
          )}
          <section aria-labelledby="historique" className="border-t pt-4">
            <h3 id="historique" className="mb-2 text-sm font-semibold">
              Historique
            </h3>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun changement de statut pour l&apos;instant.
              </p>
            ) : (
              <ol className="flex flex-col gap-3 text-sm">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="border-primary/40 flex flex-col gap-0.5 border-l-2 pl-3"
                  >
                    <span className="font-medium">
                      {ORDER_STATUS_LABELS[event.to]}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (depuis {ORDER_STATUS_LABELS[event.from].toLowerCase()})
                      </span>
                    </span>
                    {event.cancellation ? (
                      <span className="text-xs">
                        Motif : {formatCancellation(event.cancellation)}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {event.actor.name} · {formatDateTimeFr(event.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </CardContent>
      </Card>

      <Card className="@4xl/main:col-span-2">
        <CardHeader>
          <CardTitle>
            <h2>Équipe</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Qui prépare et qui livre. Les personnes proposées sont celles de la
            section Personnel, du bon métier et actives.
          </p>
          <div className="max-w-md">
            <OrderTeam
              order={order}
              options={options}
              canAssign={canAssign && !done}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="@4xl/main:col-span-2">
        <CardHeader>
          <CardTitle>
            <h2>Articles</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableCaption className="sr-only">
              Articles de la commande {order.reference}.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Produit</TableHead>
                <TableHead scope="col" className="text-right">
                  Quantité
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line) => (
                <TableRow key={line.productId}>
                  <TableCell>{line.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(line.quantity, line.unit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEuros(line.lineTotalCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {order.discount ? (
                <>
                  <TableRow>
                    <TableCell colSpan={2}>Sous-total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuros(subtotal)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2}>
                      {formatDiscount(order.discount)}
                      {order.community ? ` (${order.community.name})` : ""}
                      <span className="text-muted-foreground block text-xs">
                        Appliquée au paiement dans l&apos;application FIG
                      </span>
                    </TableCell>
                    <TableCell className="text-success text-right tabular-nums">
                      −{formatEuros(order.discount.amountCents)}
                    </TableCell>
                  </TableRow>
                </>
              ) : null}
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total dû
                </TableCell>
                <TableCell className="text-right text-base font-bold tabular-nums">
                  {formatEuros(order.totalCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
