import Link from "next/link";
import { AssignCourierForm } from "@/components/deliveries/assign-courier-form";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { tableFrame } from "@/components/orders/orders-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Courier } from "@/domain/deliveries/types";
import type { TourEntry } from "@/domain/deliveries/rules";

/*
 * Tableau de la tournée d'un jour. Composant serveur : reçoit les entrées déjà
 * croisées par buildTour() et la liste des livreurs, rend une ligne par commande.
 * Une commande non attribuable (en attente, livrée, annulée) affiche la raison à
 * la place du formulaire.
 */
const hideOnMobile = "hidden md:table-cell";

export function TourTable({
  tour,
  couriers,
  date,
}: {
  tour: TourEntry[];
  couriers: Courier[];
  date: string;
}) {
  const options = couriers.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className={tableFrame}>
      <Table>
        <TableCaption className="sr-only">
          Tournée du {date} : commandes et livreurs attribués.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Créneau</TableHead>
            <TableHead scope="col">Référence</TableHead>
            <TableHead scope="col">Client</TableHead>
            <TableHead scope="col" className={hideOnMobile}>
              Ville
            </TableHead>
            <TableHead scope="col">Statut</TableHead>
            <TableHead scope="col">Livreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tour.map(({ order, courier, assignable }) => (
            <TableRow key={order.id}>
              <TableCell className="tabular-nums">
                {order.deliverySlot.start}–{order.deliverySlot.end}
              </TableCell>
              <TableCell className="font-mono text-xs">
                <Link
                  href={`/commandes/${order.id}`}
                  className="text-foreground font-medium underline-offset-4 hover:underline focus-visible:underline"
                >
                  {order.reference}
                </Link>
              </TableCell>
              <TableCell className="font-medium">
                {order.customer.fullName}
              </TableCell>
              <TableCell className={hideOnMobile}>
                {order.deliveryPostalCode} {order.deliveryCity}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                {assignable ? (
                  <AssignCourierForm
                    orderId={order.id}
                    orderReference={order.reference}
                    couriers={options}
                    currentCourierId={courier?.id ?? null}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {courier ? courier.name : "—"}
                    {order.status === "pending" ? " (à confirmer d'abord)" : ""}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
