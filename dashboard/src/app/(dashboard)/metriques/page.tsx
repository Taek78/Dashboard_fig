import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Euro, ShoppingBasket, Wallet } from "lucide-react";
import { KpiCard } from "@/components/metrics/kpi-card";
import { RevenueChart } from "@/components/metrics/revenue-chart";
import { StatusChart } from "@/components/metrics/status-chart";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrders } from "@/data/orders";
import { todayInParis } from "@/domain/deliveries/rules";
import {
  computeKpis,
  filterByPeriod,
  METRIC_PERIOD_LABELS,
  METRIC_PERIODS,
  ordersByStatus,
  revenueByDay,
  topProducts,
} from "@/domain/metrics/rules";
import { parseMetricPeriod } from "@/domain/metrics/schemas";
import { formatEuros, formatQuantity } from "@/lib/format";

/*
 * Métriques (A6) : période choisie par l'URL (?periode=7|30|tout), KPI, CA par
 * jour, répartition par statut, top produits. Composant serveur : une lecture,
 * toutes les agrégations en fonctions pures, les graphiques (client) ne font que
 * dessiner.
 */
export const metadata: Metadata = { title: "Métriques" };

export default async function MetriquesPage({
  searchParams,
}: PageProps<"/metriques">) {
  const period = parseMetricPeriod(await searchParams);
  const today = todayInParis(new Date());
  const all = await getOrders();
  const orders = filterByPeriod(all, period, today);
  const kpis = computeKpis(orders);
  const days = revenueByDay(orders);
  const statuses = ordersByStatus(orders);
  const top = topProducts(orders, 5);

  return (
    <>
      <PageHeader
        title="Métriques"
        description="Chiffre d'affaires, volumes et produits phares."
        actions={
          <div
            role="group"
            aria-label="Période"
            className="flex flex-wrap gap-1"
          >
            {METRIC_PERIODS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === period ? "secondary" : "ghost"}
                aria-pressed={p === period}
                render={<Link href={`/metriques?periode=${p}`} />}
              >
                {METRIC_PERIOD_LABELS[p]}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires"
          value={formatEuros(kpis.revenueCents)}
          hint="hors commandes annulées"
          icon={<Euro />}
        />
        <KpiCard
          label="Commandes"
          value={String(kpis.orderCount)}
          hint={`${kpis.pendingCount} en attente`}
          icon={<ShoppingBasket />}
        />
        <KpiCard
          label="Panier moyen"
          value={formatEuros(kpis.averageBasketCents)}
          icon={<Wallet />}
        />
        <KpiCard
          label="Annulées"
          value={String(kpis.cancelledCount)}
          icon={<Ban />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Chiffre d&apos;affaires par jour</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {days.length > 0 ? (
              <RevenueChart points={days} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucune commande sur cette période.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Commandes par statut</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChart points={statuses} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Produits phares</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableCaption className="sr-only">
              Cinq produits au plus fort chiffre d&apos;affaires sur la période.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Produit</TableHead>
                <TableHead scope="col" className="text-right">
                  Quantité vendue
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Chiffre d&apos;affaires
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((p) => (
                <TableRow key={p.productId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/catalogue/${p.productId}`}
                      className="underline-offset-4 hover:underline focus-visible:underline"
                    >
                      {p.productName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(p.quantity, p.unit)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatEuros(p.revenueCents)}
                  </TableCell>
                </TableRow>
              ))}
              {top.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Aucune vente sur cette période.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
