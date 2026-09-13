import Link from "next/link";
import { ArrowRight, Euro, ShoppingBasket, Truck, Wallet } from "lucide-react";
import { KpiCard } from "@/components/metrics/kpi-card";
import { PeriodForm } from "@/components/metrics/period-form";
import { TaxModeSwitch } from "@/components/metrics/tax-mode-switch";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOrders } from "@/data/orders";
import { todayInParis } from "@/domain/deliveries/rules";
import {
  applyTaxMode,
  computeKpis,
  filterByRange,
  METRIC_PERIOD_LABELS,
  periodRange,
  TAX_MODE_LABELS,
} from "@/domain/metrics/rules";
import { parsePeriodQuery } from "@/domain/metrics/schemas";
import { formatDateFr, formatEuros } from "@/lib/format";

/*
 * Tableau de bord, route « / » (A6, période ajoutée le 2026-09-13) : l'activité
 * de la période choisie (défaut : aujourd'hui, mêmes périodes prédéfinies et
 * plage libre que les métriques) et ce qui attend une action, toutes dates.
 * Chiffres calculés par les fonctions pures de metrics ; montants HT par
 * défaut, TTC par l'interrupteur (même URL ?tva= que les métriques).
 */
export default async function TableauDeBordPage({
  searchParams,
}: PageProps<"/">) {
  const query = parsePeriodQuery(await searchParams);
  const today = todayInParis(new Date());
  const range = query.customRange ?? periodRange(query.period, today);
  const title = query.customRange
    ? `Du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`
    : METRIC_PERIOD_LABELS[query.period];
  const taxLabel = TAX_MODE_LABELS[query.tax];
  const money = (cents: number) => formatEuros(applyTaxMode(cents, query.tax));
  const baseParams = query.customRange
    ? `du=${query.customRange.from}&au=${query.customRange.to}`
    : `periode=${query.period}`;

  const [all, pending] = await Promise.all([
    getOrders(),
    getOrders({ status: "pending" }),
  ]);
  const orders = filterByRange(all, range);
  const kpis = computeKpis(orders);
  const delivering = orders.filter((o) => o.status === "delivering").length;
  const plural = (n: number) => (n > 1 ? "s" : "");

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${title} · montants ${taxLabel}.`}
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <PeriodForm
            action="/"
            period={query.period}
            customRange={query.customRange}
            range={range}
            hiddenFields={{ tva: query.tax }}
          />
          <TaxModeSwitch action="/" tax={query.tax} baseParams={baseParams} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Commandes"
          value={String(kpis.orderCount)}
          hint={`${kpis.cancelledCount} annulée${plural(kpis.cancelledCount)}`}
          icon={<ShoppingBasket />}
        />
        <KpiCard
          label={`CA ${taxLabel}`}
          value={money(kpis.revenueCents)}
          hint="hors annulées"
          icon={<Euro />}
        />
        <KpiCard
          label={`Panier moyen ${taxLabel}`}
          value={money(kpis.averageBasketCents)}
          icon={<Wallet />}
        />
        <KpiCard
          label="En livraison"
          value={String(delivering)}
          hint="statut « en livraison »"
          icon={<Truck />}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          className="justify-between sm:justify-center"
          render={<Link href="/commandes?statut=pending" />}
        >
          Commandes à confirmer
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          className="justify-between sm:justify-center"
          render={<Link href={`/livraisons?date=${today}`} />}
        >
          Tournée du jour
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          className="justify-between sm:justify-center"
          render={<Link href="/metriques" />}
        >
          Métriques
          <ArrowRight />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium">
          Commandes à confirmer ({pending.length}, toutes dates)
        </h2>
        {pending.length > 0 ? (
          <OrdersTable orders={pending} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucune commande en attente de confirmation.
          </p>
        )}
      </div>
    </>
  );
}
