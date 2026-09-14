import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { mobileCardFrame, tableFrame } from "@/components/orders/orders-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Order } from "@/domain/orders/types";
import type { StaffWorkSummary } from "@/domain/staff/rules";
import { formatDateFr, formatEuros, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Historique d'une personne (serveur) : ses compteurs, puis ses commandes
 * (préparées ou livrées), les plus récentes d'abord, bornées à `limit` pour
 * ne pas noyer la fiche. Sous 768 px une pile de cartes, au-dessus le tableau.
 * Le rôle tenu sur chaque commande est explicité (préparation, livraison, les
 * deux).
 */
const LIMIT = 60;

function roleOn(order: Order, staffId: string): string {
  const prep = order.preparer?.id === staffId;
  const drive = order.driver?.id === staffId;
  return prep && drive
    ? "Préparation et livraison"
    : prep
      ? "Préparation"
      : "Livraison";
}

export function StaffHistory({
  staffId,
  orders,
  summary,
}: {
  staffId: string;
  /** Déjà filtrées et triées (staffOrders). */
  orders: Order[];
  summary: StaffWorkSummary;
}) {
  const shown = orders.slice(0, LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Commandes préparées", summary.prepared],
          ["Livraisons terminées", summary.delivered],
          ["En cours", summary.inProgress],
          [
            "Dernière activité",
            summary.lastActivityDate
              ? formatDateFr(summary.lastActivityDate)
              : "—",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-muted/40 flex flex-col gap-1 rounded-xl border p-3"
          >
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune commande affectée pour l&apos;instant.
        </p>
      ) : (
        <>
          <p role="status" className="text-muted-foreground text-sm">
            {orders.length} commande{orders.length > 1 ? "s" : ""} affectée
            {orders.length > 1 ? "s" : ""}
            {orders.length > LIMIT
              ? `, les ${LIMIT} plus récentes affichées`
              : ""}
            .
          </p>
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((order) => (
              <li key={order.id} className={mobileCardFrame}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/commandes/${order.id}`}
                      className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                    >
                      {order.reference}
                    </Link>
                    <p className="truncate font-medium">
                      {order.customer.fullName}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatSlot(order.deliverySlot)} · {roleOn(order, staffId)}
                </p>
              </li>
            ))}
          </ul>
          <div className={cn(tableFrame, "hidden md:block")}>
            <Table>
              <TableCaption className="sr-only">
                Commandes préparées ou livrées par la personne.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Référence</TableHead>
                  <TableHead scope="col">Client</TableHead>
                  <TableHead scope="col">Créneau</TableHead>
                  <TableHead scope="col">Rôle</TableHead>
                  <TableHead scope="col" className="text-right">
                    Total
                  </TableHead>
                  <TableHead scope="col">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/commandes/${order.id}`}
                        className="text-foreground font-medium underline-offset-4 hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.customer.fullName}
                    </TableCell>
                    <TableCell>{formatSlot(order.deliverySlot)}</TableCell>
                    <TableCell>{roleOn(order, staffId)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuros(order.totalCents)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
