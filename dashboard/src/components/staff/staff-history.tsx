import Link from "next/link";
import type { ReactNode } from "react";
import { CustomerTypeLabels } from "@/components/customers/client-type-label";
import { OrderRefundBadge } from "@/components/orders/order-refund-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import {
  CustomerNameLink,
  mobileCardFrame,
  tableFrame,
} from "@/components/orders/orders-table";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Page } from "@/domain/orders/rules";
import type { Order } from "@/domain/orders/types";
import type { StaffWorkSummary } from "@/domain/staff/rules";
import type { DateRange } from "@/lib/days";
import {
  formatDateFr,
  formatEuros,
  formatPeriodFr,
  formatSlot,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Historique d'une personne (serveur) : ses compteurs (sur toutes ses
 * commandes, agrégés par la base), la recherche (emplacement `filters`), puis
 * UNE page des commandes qui correspondent, les plus récentes d'abord, et la
 * pagination (ancre #historique : la liste est sous le formulaire de la fiche).
 * Sous 768 px une pile de cartes, au-dessus le tableau. Le rôle tenu
 * (préparation, livraison, les deux) et le type de client sont explicités ;
 * le nom du client mène à sa fiche. Une période sans commande est dite par
 * un bandeau bleu (PeriodEmptyNotice), pas par une liste vide.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

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
  page,
  totalCount,
  summary,
  filtered,
  range = null,
  baseParams,
  filters,
}: {
  staffId: string;
  /** La page des commandes de la personne qui passent la recherche. */
  page: Page<Order>;
  /** Nombre de commandes affectées, sans recherche. */
  totalCount: number;
  summary: StaffWorkSummary;
  /** Une recherche est active. */
  filtered: boolean;
  /** Période de livraison appliquée par la recherche, s'il y en a une. */
  range?: DateRange | null;
  /** Recherche en cours en paramètres d'URL, gardée par la pagination. */
  baseParams: string;
  /** Formulaire de recherche, rendu sous les compteurs. */
  filters?: ReactNode;
}) {
  const orders = page.items;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 @xl/main:grid-cols-4">
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
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {totalCount === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune commande affectée pour l&apos;instant.
        </p>
      ) : (
        <>
          {filters}
          <p role="status" className="text-base font-semibold">
            {filtered
              ? `${page.total} commande${plural(page.total)} sur ${totalCount} correspond${page.total > 1 ? "ent" : ""} à la recherche`
              : `${totalCount} commande${plural(totalCount)} affectée${plural(totalCount)}`}
            {page.pageCount > 1 ? (
              <span className="text-muted-foreground text-sm font-normal">
                {` · les plus récentes d'abord, page ${page.page} sur ${page.pageCount}`}
              </span>
            ) : null}
          </p>
          {orders.length === 0 && range ? (
            <PeriodEmptyNotice
              text={`Aucune commande livrée ${formatPeriodFr(range.from, range.to)} pour cette personne.`}
              resetHref={`/personnel/${staffId}#historique`}
            />
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune commande ne correspond : modifiez ou réinitialisez la
              recherche.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-3 @2xl/main:hidden">
                {orders.map((order) => (
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
                          <CustomerNameLink customer={order.customer} />
                        </p>
                      </div>
                      <span className="inline-flex flex-wrap gap-1">
                        <OrderStatusBadge status={order.status} />
                        <OrderRefundBadge order={order} withAmount={false} />
                      </span>
                    </div>
                    <CustomerTypeLabels
                      community={order.community}
                      className="self-start"
                    />
                    <p className="text-muted-foreground text-sm">
                      {formatSlot(order.deliverySlot)} ·{" "}
                      {roleOn(order, staffId)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className={cn(tableFrame, "hidden @2xl/main:block")}>
                <Table>
                  <TableCaption className="sr-only">
                    Commandes préparées ou livrées par la personne.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Référence</TableHead>
                      <TableHead scope="col">Client</TableHead>
                      <TableHead scope="col">Type</TableHead>
                      <TableHead scope="col">Créneau</TableHead>
                      <TableHead scope="col">Rôle</TableHead>
                      <TableHead scope="col" className="text-right">
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
                            className="text-foreground font-medium underline-offset-4 hover:underline"
                          >
                            {order.reference}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          <CustomerNameLink customer={order.customer} />
                        </TableCell>
                        <TableCell>
                          <CustomerTypeLabels
                            community={order.community}
                            showName={false}
                          />
                        </TableCell>
                        <TableCell>{formatSlot(order.deliverySlot)}</TableCell>
                        <TableCell>{roleOn(order, staffId)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatEuros(order.totalCents)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex flex-wrap gap-1">
                            <OrderStatusBadge status={order.status} />
                            <OrderRefundBadge
                              order={order}
                              withAmount={false}
                            />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <OrdersPagination
                page={page}
                baseParams={baseParams}
                path={`/personnel/${staffId}`}
                hash="historique"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
