import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderStatusForm } from "@/components/orders/order-status-form";
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
import { allowedTransitions } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import {
  formatDateFr,
  formatEuros,
  formatQuantity,
  toTelHref,
} from "@/lib/format";

/*
 * Détail d'une commande. Composant serveur : il reçoit une Order déjà chargée par
 * la page et l'affiche en quatre cartes (Client, Livraison, Statut, Articles).
 *
 * - Grille lg (pas md) : à 768 px avec la sidebar dépliée, trois colonnes seraient
 *   trop étroites. Ordre DOM = ordre visuel pour les lecteurs d'écran.
 * - Un seul h1 (PageHeader) ; chaque carte porte un h2.
 * - `allowed` est calculé ICI, côté serveur, par la règle pure : le formulaire
 *   client ne propose que ces options, et l'action les recalcule de toute façon.
 * - <dl> : « libellé → valeur » pour un lecteur d'écran, sans tableau.
 */
export function OrderDetail({
  order,
  canEdit,
}: {
  order: Order;
  /** Rôle autorisé à changer le statut (A7). Confort d'affichage : l'action revérifie. */
  canEdit: boolean;
}) {
  const allowed = allowedTransitions(order.status);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
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
            <dt className="text-muted-foreground">Adresse</dt>
            <dd className="font-medium">
              {order.deliveryPostalCode} {order.deliveryCity}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>
            <h2>Statut</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <OrderStatusBadge status={order.status} />
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
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
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
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
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
