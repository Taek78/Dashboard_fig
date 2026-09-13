import Link from "next/link";
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
 * - Le conteneur arrondi avec bordure et fond carte est partagé avec loading.tsx
 *   (même enveloppe, donc aucun saut visuel au chargement).
 * - La Référence est un lien vers le détail, seule cible cliquable de la ligne : un
 *   <tr> cliquable n'est ni focusable ni annoncé comme lien. Pas de
 *   text-muted-foreground sur un lien (contraste 4,5:1 exigé).
 */
const hideOnMobile = "hidden md:table-cell";
const numeric = "text-right tabular-nums";

export const tableFrame =
  "overflow-hidden rounded-2xl border bg-card shadow-sm [&_td]:py-3 [&_th]:py-3 [&_thead]:bg-muted/40";

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className={tableFrame}>
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
              <TableCell>{formatSlot(order.deliverySlot)}</TableCell>
              <TableCell className={hideOnMobile}>
                {order.deliveryCity}
              </TableCell>
              <TableCell className={`${hideOnMobile} ${numeric}`}>
                {order.lines.length}
              </TableCell>
              <TableCell className={`${numeric} font-medium`}>
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
  );
}
