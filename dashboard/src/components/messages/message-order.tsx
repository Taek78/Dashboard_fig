import Link from "next/link";
import {
  CalendarClock,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Truck,
  User,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { MessageOrder } from "@/domain/messages/types";
import { formatDateFr, formatDateTimeFr } from "@/lib/format";

/*
 * La commande que le client a jointe à son message (serveur) : sa référence
 * (lien), quand elle a été passée, quand et où elle est livrée, qui la
 * prépare et qui la livre. Deux formes : une ligne compacte sur la carte, une
 * liste complète sur la fiche du message. Rien ici n'est modifiable : la
 * commande se pilote depuis sa propre fiche.
 */
const slotText = (order: MessageOrder) =>
  `${formatDateFr(order.deliverySlot.date)}, ${order.deliverySlot.start}–${order.deliverySlot.end}`;

const addressText = (order: MessageOrder) =>
  [
    order.community?.name,
    order.deliveryAddressLine,
    `${order.deliveryPostalCode} ${order.deliveryCity}`,
  ]
    .filter(Boolean)
    .join(", ");

export function MessageOrderLine({ order }: { order: MessageOrder }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1.5">
        <ShoppingBasket className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Commande associée</span>
        <Link
          href={`/commandes/${order.id}`}
          className="font-mono underline-offset-4 hover:underline"
        >
          {order.reference}
        </Link>
      </span>
      <span>
        <span className="sr-only">Livraison </span>
        {slotText(order)}
      </span>
      <span>
        <span className="text-muted-foreground">Préparateur :</span>{" "}
        {order.preparer?.name ?? "non affecté"}
      </span>
      <span>
        <span className="text-muted-foreground">Livreur :</span>{" "}
        {order.driver?.name ?? "non affecté"}
      </span>
    </div>
  );
}

export function MessageOrderDetails({ order }: { order: MessageOrder }) {
  return (
    <section
      aria-labelledby="commande-jointe"
      className="bg-muted/40 flex flex-col gap-3 rounded-none px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="commande-jointe"
          className="flex items-center gap-2 font-semibold"
        >
          <ShoppingBasket className="size-4 shrink-0" aria-hidden="true" />
          Commande jointe :{" "}
          <Link
            href={`/commandes/${order.id}`}
            className="font-mono underline-offset-4 hover:underline"
          >
            {order.reference}
          </Link>
        </h3>
        <OrderStatusBadge status={order.status} />
      </div>
      <dl className="grid grid-cols-[1.25rem_auto_1fr] gap-x-2 gap-y-1.5 @2xl/main:grid-cols-[1.25rem_auto_1fr_1.25rem_auto_1fr]">
        <dt className="text-muted-foreground contents">
          <CalendarClock className="size-4" aria-hidden="true" />
          <span>Commandée le</span>
        </dt>
        <dd className="font-medium">{formatDateTimeFr(order.createdAt)}</dd>
        <dt className="text-muted-foreground contents">
          <Truck className="size-4" aria-hidden="true" />
          <span>Livraison</span>
        </dt>
        <dd className="font-medium tabular-nums">{slotText(order)}</dd>
        <dt className="text-muted-foreground contents">
          <MapPin className="size-4" aria-hidden="true" />
          <span>{order.community ? "Point de retrait" : "Adresse"}</span>
        </dt>
        <dd className="font-medium wrap-anywhere">{addressText(order)}</dd>
        <dt className="text-muted-foreground contents">
          <PackageCheck className="size-4" aria-hidden="true" />
          <span>Préparateur</span>
        </dt>
        <dd className="font-medium">
          {order.preparer?.name ?? (
            <span className="text-muted-foreground font-normal">
              Non affecté
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground contents">
          <User className="size-4" aria-hidden="true" />
          <span>Livreur</span>
        </dt>
        <dd className="font-medium">
          {order.driver?.name ?? (
            <span className="text-muted-foreground font-normal">
              Non affecté
            </span>
          )}
        </dd>
      </dl>
    </section>
  );
}
