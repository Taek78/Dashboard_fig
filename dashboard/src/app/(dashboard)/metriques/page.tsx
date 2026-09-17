import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  Contact,
  Download,
  Euro,
  Gift,
  MessageSquareWarning,
  ShoppingBasket,
  Star,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/metrics/kpi-card";
import { MetricsControls } from "@/components/metrics/metrics-controls";
import { ComparisonChart } from "@/components/metrics/comparison-chart";
import { Section } from "@/components/section";
import { RatioPie } from "@/components/metrics/ratio-pie";
import { StatusChart } from "@/components/metrics/status-chart";
import { TrendBadge } from "@/components/metrics/trend-badge";
import { PageHeader } from "@/components/page-header";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
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
import { getSignupStats } from "@/data/customers";
import { getEngagement } from "@/data/engagement";
import { countComplaints } from "@/data/messages";
import { getOrderSeries, getOrderStats, getTopProducts } from "@/data/orders";
import { todayInParis } from "@/domain/deliveries/rules";
import { ratioPercent, summarizeEngagement } from "@/domain/engagement/rules";
import {
  applyTaxMode,
  applyTaxToValues,
  bucketFor,
  compareSeries,
  COMPARISON_LABELS,
  METRIC_PERIOD_LABELS,
  periodRange,
  previousYearRange,
  referenceRange,
  statusPoints,
  TAX_MODE_LABELS,
} from "@/domain/metrics/rules";
import { parseMetricsQuery } from "@/domain/metrics/schemas";
import {
  formatDateFr,
  formatEuros,
  formatPeriodFr,
  formatQuantity,
} from "@/lib/format";

/*
 * Métriques : période prédéfinie ou personnalisée, montants HT ou TTC, référence
 * de comparaison (N-1 ou période précédente), badge de tendance sur chaque KPI.
 * Rangées par thème, chacune dans sa section titrée :
 *   1. Ventes : commandes, CA, panier moyen, acheteurs (les quatre chiffres
 *      qui se lisent en premier), graphe d'évolution ;
 *   2. Commandes : annulations, part des communautés (indicateur et
 *      tendance), RÉCLAMATIONS reçues par messages sur la période (objets de
 *      CLAIM_SUBJECTS, comptées par la base), répartition par statut ;
 *   3. Clients : nouveaux inscrits et parrainages de la période ;
 *   4. Produits : les produits phares ;
 *   5. Usage de l'application sur l'année civile de la période (stores),
 *      en deux colonnes sur deux lignes : chaque carte a la place de son
 *      libellé, de son aide et de son camembert (demande du 2026-09-17).
 * Les ratios sont des camemberts pleins, sans pourcentage écrit : au survol,
 * chaque part dit ce qu'elle représente.
 * Composant serveur : les chiffres des deux périodes, les deux séries, les
 * produits phares, les réclamations, les inscriptions et les acheteurs de
 * l'année sont AGRÉGÉS par la base (douze requêtes parallèles, quelques
 * lignes chacune), puis mis en forme par les règles pures (statsFromTotals,
 * fillSeries, rankProducts, ratioPercent).
 */
export const metadata: Metadata = { title: "Métriques" };

const pct = (value: number | null) => (value === null ? "—" : `${value} %`);
const plural = (n: number) => (n > 1 ? "s" : "");

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

  const bucket = bucketFor(range);
  // Usage de l'application : année civile de la fin de la période, vs l'année d'avant.
  const year = range.to.slice(0, 4);
  const yearLabel = `Année ${Number(year) - 1}`;
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };
  const yearRef = previousYearRange(yearRange);

  const [
    stats,
    statsRef,
    series,
    seriesRef,
    top,
    yearStats,
    yearStatsRef,
    engagement,
    complaints,
    complaintsRef,
    signups,
    signupsRef,
  ] = await Promise.all([
    getOrderStats(range),
    getOrderStats(reference),
    getOrderSeries(range, bucket),
    getOrderSeries(reference, bucket),
    getTopProducts(range, 5),
    getOrderStats(yearRange),
    getOrderStats(yearRef),
    getEngagement(),
    countComplaints(range),
    countComplaints(reference),
    getSignupStats(range),
    getSignupStats(reference),
  ]);
  const { kpis, share, buyers: buyersInRange } = stats;
  const { kpis: kpisRef, share: shareRef, buyers: buyersInRangeRef } = statsRef;
  const comparison = compareSeries(series, seriesRef).map((p) => ({
    ...p,
    current: applyTaxToValues(p.current, query.tax),
    previous: applyTaxToValues(p.previous, query.tax),
  }));
  const statuses = statusPoints(stats.statusCounts);
  const title = query.customRange
    ? `Du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`
    : METRIC_PERIOD_LABELS[query.period];

  const usage = summarizeEngagement(engagement, yearRange);
  const usageRef = summarizeEngagement(engagement, yearRef);
  const buyers = yearStats.buyers;
  const buyersRef = yearStatsRef.buyers;
  const signupRate = ratioPercent(usage.signups, usage.downloads);
  const signupRateRef = ratioPercent(usageRef.signups, usageRef.downloads);
  const buyerRate = ratioPercent(buyers, usage.signups);
  const buyerRateRef = ratioPercent(buyersRef, usageRef.signups);
  const referredRate = ratioPercent(signups.referred, signups.signups);

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

      {query.customRange && kpis.orderCount === 0 ? (
        <PeriodEmptyNotice
          text={`Aucune commande livrée ${formatPeriodFr(range.from, range.to)} : les chiffres de la période sont à zéro.`}
          resetHref={`/metriques?tva=${query.tax}&comparaison=${query.comparison}`}
          resetLabel="Revenir à ce mois-ci"
        />
      ) : null}

      <Section id="ventes" title="Ventes">
        <div className="grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
          <KpiCard
            label="Commandes"
            value={String(kpis.orderCount)}
            hint={`${kpis.preparingCount} en préparation`}
            icon={<ShoppingBasket />}
            trend={trend(kpis.orderCount, kpisRef.orderCount)}
          />
          <KpiCard
            label={`CA ${taxLabel}`}
            value={money(kpis.revenueCents)}
            hint="hors annulées"
            icon={<Euro />}
            trend={trend(kpis.revenueCents, kpisRef.revenueCents)}
            tone="brand"
          />
          <KpiCard
            label={`Panier moyen ${taxLabel}`}
            value={money(kpis.averageBasketCents)}
            icon={<Wallet />}
            trend={trend(kpis.averageBasketCents, kpisRef.averageBasketCents)}
          />
          <KpiCard
            label="Acheteurs distincts"
            value={String(buyersInRange)}
            icon={<Contact />}
            trend={trend(buyersInRange, buyersInRangeRef)}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>
                Évolution : {title.toLowerCase()} et{" "}
                {referenceLabel.toLowerCase()}
              </h3>
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
      </Section>

      <Section id="commandes" title="Commandes">
        <div className="grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          <KpiCard
            label="Annulées"
            value={String(kpis.cancelledCount)}
            icon={<Ban />}
            trend={trend(kpis.cancelledCount, kpisRef.cancelledCount, true)}
            visual={
              <RatioPie
                label="part des commandes annulées"
                slices={[
                  {
                    label: "Annulées",
                    value: kpis.cancelledCount,
                    tone: "destructive",
                  },
                  {
                    label: "Non annulées",
                    value: kpis.orderCount - kpis.cancelledCount,
                    tone: "rest",
                  },
                ]}
              />
            }
          />
          <KpiCard
            label="Commandes communauté"
            value={String(share.community)}
            hint={
              share.percent === null
                ? "aucune commande sur la période"
                : `${pct(share.percent)} des commandes · ${share.individual} de particuliers`
            }
            icon={<Users />}
            trend={trend(share.community, shareRef.community)}
            visual={
              <RatioPie
                label="commandes de communautés et de particuliers"
                slices={[
                  {
                    label: "Communautés",
                    value: share.community,
                    tone: "community",
                  },
                  {
                    label: "Particuliers",
                    value: share.individual,
                    tone: "individual",
                  },
                ]}
              />
            }
          />
          <KpiCard
            label="Réclamations"
            value={String(complaints)}
            hint={`message${plural(complaints)} reçu${plural(complaints)}`}
            icon={<MessageSquareWarning />}
            trend={trend(complaints, complaintsRef, true)}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>Commandes par statut</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChart points={statuses} />
          </CardContent>
        </Card>
      </Section>

      <Section id="clients" title="Clients">
        <div className="grid gap-4 @xl/main:grid-cols-2">
          <KpiCard
            label="Nouveaux clients"
            value={String(signups.signups)}
            icon={<UserPlus />}
            trend={trend(signups.signups, signupsRef.signups)}
          />
          <KpiCard
            label="Parrainages"
            value={String(signups.referred)}
            hint={
              referredRate === null
                ? "aucune inscription sur la période"
                : `${pct(referredRate)} des nouveaux clients`
            }
            icon={<Gift />}
            trend={trend(signups.referred, signupsRef.referred)}
            visual={
              <RatioPie
                label="part des nouveaux clients parrainés"
                slices={[
                  {
                    label: "Parrainés",
                    value: signups.referred,
                    tone: "brand",
                  },
                  {
                    label: "Sans code",
                    value: Math.max(0, signups.signups - signups.referred),
                    tone: "rest",
                  },
                ]}
              />
            }
          />
        </div>
      </Section>

      <Section id="produits" title="Produits">
        <Card>
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
      </Section>

      <Section
        id="usage"
        title={`Usage de l'application en ${year}`}
        description={`Variations par rapport à ${Number(year) - 1}.`}
      >
        <div className="grid gap-4 @xl/main:grid-cols-2">
          <KpiCard
            label="Téléchargements"
            value={usage.downloads.toLocaleString("fr-FR")}
            icon={<Download />}
            trend={trend(usage.downloads, usageRef.downloads, false, yearLabel)}
          />
          <KpiCard
            label="Inscrits / téléchargements"
            value={pct(signupRate)}
            hint={`${usage.signups.toLocaleString("fr-FR")} inscriptions`}
            icon={<UserPlus />}
            visual={
              <RatioPie
                label="part des téléchargements devenus inscriptions"
                slices={[
                  { label: "Inscrits", value: usage.signups, tone: "brand" },
                  {
                    label: "Téléchargements sans inscription",
                    value: Math.max(0, usage.downloads - usage.signups),
                    tone: "rest",
                  },
                ]}
              />
            }
            trend={trend(signupRate, signupRateRef, false, yearLabel)}
          />
          <KpiCard
            label="Inscrits ayant commandé"
            value={pct(buyerRate)}
            hint={`${buyers} acheteur${plural(buyers)} distinct${plural(buyers)}`}
            icon={<UserCheck />}
            visual={
              <RatioPie
                label="part des inscrits ayant commandé"
                slices={[
                  {
                    label: "Inscrits ayant commandé",
                    value: buyers,
                    tone: "success",
                  },
                  {
                    label: "Inscrits sans commande",
                    value: Math.max(0, usage.signups - buyers),
                    tone: "rest",
                  },
                ]}
              />
            }
            trend={trend(buyerRate, buyerRateRef, false, yearLabel)}
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
            trend={trend(usage.rating, usageRef.rating, false, yearLabel)}
          />
        </div>
      </Section>
    </>
  );
}
