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
import { cn } from "@/lib/utils";

/*
 * Liste des commandes. Composant serveur : reçoit des Order déjà chargées par
 * la page et les rend, sans aller chercher de données.
 *
 * Deux rendus selon la largeur, un seul affiché à la fois (display:none, donc
 * un seul lu par les lecteurs d'écran) :
 * - sous 768 px, une pile de cartes : une commande = une carte cliquable, les
 *   informations utiles en tournée (client, créneau, ville, total, statut) ;
 * - à partir de 768 px, le tableau : Ville et Articles n'apparaissent qu'à
 *   partir de 1024 px (avec la sidebar dépliée, 768 px laissent peu de place).
 * - Une classe de colonne va sur le TableHead ET le TableCell, sinon l'en-tête se
 *   décale. Les nombres sont alignés à droite avec tabular-nums.
 * - Le conteneur arrondi (tableFrame) est partagé avec loading.tsx : même
 *   enveloppe, donc aucun saut visuel au chargement.
 * - Dans le tableau, la Référence est le seul lien : un <tr> cliquable n'est ni
 *   focusable ni annoncé comme lien.
 */
export const hideUntilLg = "hidden @4xl/main:table-cell";
const numeric = "text-right tabular-nums";

export const tableFrame =
  "overflow-x-auto rounded-2xl border bg-card shadow-sm [&_td]:py-3 [&_th]:py-3 [&_thead]:bg-muted/40 [&_tbody_tr]:transition-colors [&_tbody_tr:nth-child(even)]:bg-muted/20 [&_tbody_tr:hover]:bg-accent/40";

/** Cadre d'une carte de la pile mobile (partagé avec les squelettes). */
export const mobileCardFrame =
  "bg-card text-card-foreground ring-foreground/10 flex flex-col gap-2 rounded-2xl p-4 shadow-sm ring-1";

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <>
      <ul className="flex flex-col gap-3 @2xl/main:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/commandes/${order.id}`}
              aria-label={`Commande ${order.reference}, ${order.customer.fullName}`}
              className={cn(
                mobileCardFrame,
                "focus-visible:ring-ring transition-shadow outline-none hover:shadow-md focus-visible:ring-2",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {order.customer.fullName}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {order.reference}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Créneau</dt>
                <dd className="tabular-nums">
                  {formatSlot(order.deliverySlot)}
                </dd>
                <dt className="text-muted-foreground">Ville</dt>
                <dd>{order.deliveryCity}</dd>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular-nums">
                  <span className="font-medium">
                    {formatEuros(order.totalCents)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {order.lines.length} article
                    {order.lines.length > 1 ? "s" : ""}
                  </span>
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <div className={cn(tableFrame, "hidden @2xl/main:block")}>
        <Table>
          <TableCaption className="sr-only">
            Liste des commandes triées par créneau de livraison.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Référence</TableHead>
              <TableHead scope="col">Client</TableHead>
              <TableHead scope="col">Créneau</TableHead>
              <TableHead scope="col" className={hideUntilLg}>
                Ville
              </TableHead>
              <TableHead scope="col" className={`${hideUntilLg} ${numeric}`}>
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
                <TableCell className={hideUntilLg}>
                  {order.deliveryCity}
                </TableCell>
                <TableCell className={`${hideUntilLg} ${numeric}`}>
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
    </>
  );
}
