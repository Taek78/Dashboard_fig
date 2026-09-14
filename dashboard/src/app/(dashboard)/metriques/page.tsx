import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  Download,
  Euro,
  MessageSquareWarning,
  ShoppingBasket,
  Star,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/metrics/kpi-card";
import { MetricsControls } from "@/components/metrics/metrics-controls";
import { ComparisonChart, StatusChart } from "@/components/metrics/charts-lazy";
import { RatioDonut } from "@/components/metrics/ratio-donut";
import { TrendBadge } from "@/components/metrics/trend-badge";
import { PageHeader } from "@/components/page-header";
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
import { getEngagement } from "@/data/engagement";
import { getOrders } from "@/data/orders";
import { todayInParis } from "@/domain/deliveries/rules";
import { ratioPercent, summarizeEngagement } from "@/domain/engagement/rules";
import {
  applyTaxMode,
  applyTaxToValues,
  bucketFor,
  compareSeries,
  COMPARISON_LABELS,
  computeKpis,
  distinctBuyers,
  filterByRange,
  METRIC_PERIOD_LABELS,
  ordersByStatus,
  periodRange,
  previousYearRange,
  referenceRange,
  revenueSeries,
  TAX_MODE_LABELS,
  topProducts,
} from "@/domain/metrics/rules";
import { parseMetricsQuery } from "@/domain/metrics/schemas";
import { formatDateFr, formatEuros, formatQuantity } from "@/lib/format";

/*
 * Métriques : période prédéfinie ou plage libre,
 * montants HT ou TTC, référence de comparaison (N-1 ou période précédente),
 * badge de tendance sur chaque KPI, graphe pleine largeur, statuts, produits
 * phares, et un bloc « usage de l'application » sur l'année civile de la période
 * (téléchargements, inscriptions, acheteurs, réclamations, note).
 * Composant serveur : deux lectures, toutes les agrégations en fonctions pures.
 */
export const metadata: Metadata = { title: "Métriques" };

export default async function MetriquesPage({
  searchParams,
}: PageProps<"/metriques">) {
  const query = parseMetricsQuery(await searchParams);
  const today = todayInParis(new Date());
  const range = query.customRange ?? periodRange(query.period, today);
  const reference = referenceRange(range, query.comparison);
  const referenceLabel = COMPARISON_LABELS[query.comparison];
  const taxLabel = TAX_MODE_LABELS[query.tax];
  const money = (cents: number) => formatEuros(applyTaxMode(cents, query.tax));

  const [all, engagement] = await Promise.all([getOrders(), getEngagement()]);
  const orders = filterByRange(all, range);
  const kpis = computeKpis(orders);
  const kpisRef = computeKpis(filterByRange(all, reference));
  const bucket = bucketFor(range);
  const comparison = compareSeries(
    revenueSeries(all, range, bucket),
    revenueSeries(all, reference, bucket),
  ).map((p) => ({
    ...p,
    current: applyTaxToValues(p.current, query.tax),
    previous: applyTaxToValues(p.previous, query.tax),
  }));
  const statuses = ordersByStatus(orders);
  const top = topProducts(orders, 5);
  const title = query.customRange
    ? `Du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`
    : METRIC_PERIOD_LABELS[query.period];

  // Usage de l'application : année civile de la fin de la période, vs l'année d'avant.
  const year = range.to.slice(0, 4);
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };
  const yearRef = previousYearRange(yearRange);
  const usage = summarizeEngagement(engagement, yearRange);
  const usageRef = summarizeEngagement(engagement, yearRef);
  const buyers = distinctBuyers(filterByRange(all, yearRange));
  const buyersRef = distinctBuyers(filterByRange(all, yearRef));
  const signupRate = ratioPercent(usage.signups, usage.downloads);
  const signupRateRef = ratioPercent(usageRef.signups, usageRef.downloads);
  const buyerRate = ratioPercent(buyers, usage.signups);
  const buyerRateRef = ratioPercent(buyersRef, usageRef.signups);

  const trend = (
    current: number | null,
    previous: number | null,
    lowerIsBetter = false,
    label = referenceLabel,
  ) => (
    <TrendBadge
      current={current}
      previous={previous}
      lowerIsBetter={lowerIsBetter}
      referenceLabel={label}
    />
  );

  return (
    <>
      <PageHeader
        title="Métriques"
        description={`${title} · montants ${taxLabel} · variations vs ${referenceLabel.toLowerCase()}.`}
      />

      <MetricsControls query={query} range={range} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`CA ${taxLabel}`}
          value={money(kpis.revenueCents)}
          hint="hors annulées"
          icon={<Euro />}
          trend={trend(kpis.revenueCents, kpisRef.revenueCents)}
          tone="brand"
        />
        <KpiCard
          label="Commandes"
          value={String(kpis.orderCount)}
          hint={`${kpis.pendingCount} en attente`}
          icon={<ShoppingBasket />}
          trend={trend(kpis.orderCount, kpisRef.orderCount)}
        />
        <KpiCard
          label={`Panier moyen ${taxLabel}`}
          value={money(kpis.averageBasketCents)}
          icon={<Wallet />}
          trend={trend(kpis.averageBasketCents, kpisRef.averageBasketCents)}
        />
        <KpiCard
          label="Annulées"
          value={String(kpis.cancelledCount)}
          hint="moins, c'est mieux"
          icon={<Ban />}
          trend={trend(kpis.cancelledCount, kpisRef.cancelledCount, true)}
          visual={
            <RatioDonut
              percent={ratioPercent(kpis.cancelledCount, kpis.orderCount)}
              label="part des commandes annulées"
              tone="destructive"
            />
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              Évolution : {title.toLowerCase()} et{" "}
              {referenceLabel.toLowerCase()}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonChart
            points={comparison}
            bucket={bucket}
            taxLabel={taxLabel}
            referenceLabel={referenceLabel}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Usage de l&apos;application en {year}
          </h2>
          <p className="text-muted-foreground text-sm">
            Année civile de la période choisie, variations par rapport à{" "}
            {Number(year) - 1}. Téléchargements, inscriptions, réclamations et
            note viennent des stores et du support.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Téléchargements"
            value={usage.downloads.toLocaleString("fr-FR")}
            icon={<Download />}
            trend={trend(
              usage.downloads,
              usageRef.downloads,
              false,
              `Année ${Number(year) - 1}`,
            )}
          />
          <KpiCard
            label="Inscrits / téléchargements"
            value={signupRate === null ? "—" : `${signupRate} %`}
            hint={`${usage.signups.toLocaleString("fr-FR")} inscriptions`}
            icon={<UserPlus />}
            visual={
              <RatioDonut
                percent={signupRate}
                label="part des téléchargements devenus inscriptions"
              />
            }
            trend={trend(
              signupRate,
              signupRateRef,
              false,
              `Année ${Number(year) - 1}`,
            )}
          />
          <KpiCard
            label="Inscrits ayant commandé"
            value={buyerRate === null ? "—" : `${buyerRate} %`}
            hint={`${buyers} acheteur${buyers > 1 ? "s" : ""} distinct${buyers > 1 ? "s" : ""}`}
            icon={<UserCheck />}
            visual={
              <RatioDonut
                percent={buyerRate}
                label="part des inscrits ayant commandé"
                tone="success"
              />
            }
            trend={trend(
              buyerRate,
              buyerRateRef,
              false,
              `Année ${Number(year) - 1}`,
            )}
          />
          <KpiCard
            label="Réclamations"
            value={String(usage.complaints)}
            hint="moins, c'est mieux"
            icon={<MessageSquareWarning />}
            trend={trend(
              usage.complaints,
              usageRef.complaints,
              true,
              `Année ${Number(year) - 1}`,
            )}
          />
          <KpiCard
            label="Note de l'appli"
            value={
              usage.rating === null
                ? "—"
                : `${usage.rating.toLocaleString("fr-FR")} / 5`
            }
            hint={`${usage.ratingCount} avis`}
            icon={<Star />}
            trend={trend(
              usage.rating,
              usageRef.rating,
              false,
              `Année ${Number(year) - 1}`,
            )}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Produits phares ({taxLabel})</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableCaption className="sr-only">
                Cinq produits au plus fort chiffre d&apos;affaires sur la
                période.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Produit</TableHead>
                  <TableHead scope="col" className="text-right">
                    Quantité
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    CA {taxLabel}
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
                      {money(p.revenueCents)}
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
      </div>
    </>
  );
}
