import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer } from "@/data/customers";
import { getOrders } from "@/data/orders";
import {
  computeCustomerStats,
  sortNotesNewestFirst,
} from "@/domain/customers/rules";
import { customerIdSchema } from "@/domain/customers/schemas";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";

/*
 * Fiche client : coordonnées, chiffres clés, historique des commandes
 * (croisement via OrderFilters.customerId), notes internes et formulaire d'ajout.
 */
export const metadata: Metadata = { title: "Fiche client" };

export default async function ClientPage({
  params,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const parsed = customerIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const customer = await getCustomer(parsed.data);
  if (!customer) notFound();

  const orders = await getOrders({ customerId: customer.id });
  const stats = computeCustomerStats(orders);
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
      <div className="grid gap-4 lg:grid-cols-3">
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

        <Card className="lg:row-span-2">
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

        <div className="flex flex-col gap-2 lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Historique des commandes
          </h2>
          {orders.length > 0 ? (
            <OrdersTable orders={orders} />
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
