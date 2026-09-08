import { OrderStatusBadge } from "@/components/orders/order-status-badge";
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
import { formatEuros, formatSlot } from "@/lib/format";

/*
 * Tableau des commandes. Composant serveur : reçoit des Order déjà chargées par
 * la page et les rend, sans aller chercher de données.
 *
 * - La caption sr-only nomme le tableau pour les lecteurs d'écran sans doubler le h1.
 * - Une classe de colonne (masquage mobile, alignement) va sur le TableHead ET le
 *   TableCell, sinon l'en-tête se décale.
 * - Ville et Articles sont masquées sous 768 px ; les nombres sont alignés à droite
 *   avec tabular-nums pour que les chiffres se superposent.
 * - Pas de lien sur les lignes en A1 : la cellule Référence l'accueillera en A2.
 */
const hideOnMobile = "hidden md:table-cell";
const numeric = "text-right tabular-nums";

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <Table>
      <TableCaption className="sr-only">
        Liste des commandes triées par créneau de livraison.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Référence</TableHead>
          <TableHead scope="col">Client</TableHead>
          <TableHead scope="col">Créneau</TableHead>
          <TableHead scope="col" className={hideOnMobile}>
            Ville
          </TableHead>
          <TableHead scope="col" className={`${hideOnMobile} ${numeric}`}>
            Articles
          </TableHead>
          <TableHead scope="col" className={numeric}>
            Total
          </TableHead>
          <TableHead scope="col">Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono text-xs">
              {order.reference}
            </TableCell>
            <TableCell className="font-medium">
              {order.customer.fullName}
            </TableCell>
            <TableCell>{formatSlot(order.deliverySlot)}</TableCell>
            <TableCell className={hideOnMobile}>{order.deliveryCity}</TableCell>
            <TableCell className={`${hideOnMobile} ${numeric}`}>
              {order.lines.length}
            </TableCell>
            <TableCell className={numeric}>
              {formatEuros(order.totalCents)}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
