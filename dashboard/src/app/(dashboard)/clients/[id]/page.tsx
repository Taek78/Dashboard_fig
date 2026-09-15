import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { CustomerHistoryFilters } from "@/components/customers/customer-history-filters";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { LoyaltyGauge } from "@/components/customers/loyalty-badge";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer } from "@/data/customers";
import { getDirectoryStats, getOrdersPage } from "@/data/orders";
import { loyaltyFromStreak } from "@/domain/customers/loyalty";
import {
  computeCustomerStats,
  sortNotesNewestFirst,
} from "@/domain/customers/rules";
import {
  customerIdSchema,
  parseCustomerHistoryPeriod,
} from "@/domain/customers/schemas";
import { orderFiltersQuery } from "@/domain/orders/rules";
import { parsePage } from "@/domain/orders/schemas";
import {
  formatDateFr,
  formatEuros,
  formatPeriodFr,
  toTelHref,
} from "@/lib/format";

/*
 * Fiche client : coordonnées (et communauté), chiffres clés, fidélité (série
 * de commandes d'affilée), historique des commandes (croisement via
 * OrderFilters.customerId), notes internes et formulaire d'ajout.
 * Chiffres et série de fidélité agrégés par la base (getDirectoryStats
 * restreint au client, mêmes règles que l'annuaire, toujours sur TOUTES ses
 * commandes) ; l'historique est lu page par page (?page=, les plus récentes
 * d'abord), jamais en entier, et se restreint à une période de livraison
 * (?du=&au=, filtrée par la base) que la pagination garde.
 */
export const metadata: Metadata = { title: "Fiche client" };

const NO_STATS = computeCustomerStats([]);
const plural = (n: number) => (n > 1 ? "s" : "");

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const parsed = customerIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const raw = await searchParams;
  const period = parseCustomerHistoryPeriod(raw);

  const [customer, directory, history] = await Promise.all([
    getCustomer(parsed.data),
    getDirectoryStats({ customerId: parsed.data }),
    getOrdersPage({ customerId: parsed.data, ...period }, parsePage(raw)),
  ]);
  if (!customer) notFound();

  const stats = directory.customers.get(customer.id) ?? NO_STATS;
  const periodText = formatPeriodFr(period.from, period.to);
  const loyalty = loyaltyFromStreak(
    directory.loyaltyStreaks.get(customer.id) ?? 0,
  );
  const notes = sortNotesNewestFirst(customer.notes);

  return (
    <>
      <PageHeader
        title={customer.fullName}
        description={`Client depuis le ${formatDateFr(customer.createdAt)}`}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/clients" />}>
            <ArrowLeft />
            Retour aux clients
          </Button>
        }
      />
      <ClientTypeLabel community={customer.community} className="self-start" />
      <div className="grid gap-4 @4xl/main:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Coordonnées</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">
                <a
                  href={`mailto:${customer.email}`}
                  className="underline-offset-4 hover:underline"
                >
                  {customer.email}
                </a>
              </dd>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd className="font-medium">
                <a
                  href={toTelHref(customer.phone)}
                  className="underline-offset-4 hover:underline"
                >
                  {customer.phone}
                </a>
              </dd>
              <dt className="text-muted-foreground">Adresse</dt>
              <dd className="font-medium">
                {customer.postalCode} {customer.city}
              </dd>
              {customer.community ? (
                <>
                  <dt className="text-muted-foreground">Communauté</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/clients/communautes/${customer.community.id}`}
                      className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                    >
                      <Users className="size-4" aria-hidden="true" />
                      {customer.community.name}
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Chiffres clés</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Commandes</dt>
              <dd className="font-medium tabular-nums">{stats.orderCount}</dd>
              <dt className="text-muted-foreground">Total (hors annulées)</dt>
              <dd className="font-medium tabular-nums">
                {formatEuros(stats.totalSpentCents)}
              </dd>
              <dt className="text-muted-foreground">Dernière livraison</dt>
              <dd className="font-medium">
                {stats.lastDeliveryDate
                  ? formatDateFr(stats.lastDeliveryDate)
                  : "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="@4xl/main:row-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Notes internes</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucune note pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="bg-muted/40 rounded-lg border px-3 py-2 text-sm"
                  >
                    <p>{note.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {note.authorName} · {formatDateFr(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <CustomerNoteForm customerId={customer.id} />
          </CardContent>
        </Card>

        <Card className="@4xl/main:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Fidélité</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer.community ? (
              <p className="text-muted-foreground text-sm">
                Membre d&apos;une communauté : la remise de la communauté
                s&apos;applique à chaque commande, la fidélité individuelle ne
                se cumule pas.
              </p>
            ) : (
              <LoyaltyGauge status={loyalty} />
            )}
          </CardContent>
        </Card>

        <div
          id="historique"
          className="flex scroll-mt-20 flex-col gap-2 @4xl/main:col-span-2"
        >
          <h2 className="text-lg font-semibold tracking-tight">
            Historique des commandes
          </h2>
          {stats.orderCount > 0 || periodText !== "" ? (
            <>
              <CustomerHistoryFilters
                customerId={customer.id}
                period={period}
              />
              <p role="status" className="text-muted-foreground text-sm">
                {periodText === ""
                  ? `${history.total} commande${plural(history.total)}, les plus récentes d'abord`
                  : `${history.total} commande${plural(history.total)} sur ${stats.orderCount}, livraison ${periodText}`}
                {history.pageCount > 1
                  ? ` · page ${history.page} sur ${history.pageCount}`
                  : ""}
              </p>
              {history.total > 0 ? (
                <>
                  <OrdersTable orders={history.items} />
                  <OrdersPagination
                    page={history}
                    baseParams={orderFiltersQuery(period)}
                    path={`/clients/${customer.id}`}
                    hash="historique"
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Aucune commande livrée sur cette période : élargissez-la ou
                  affichez toutes les dates.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucune commande pour ce client.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
