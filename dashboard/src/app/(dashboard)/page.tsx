import Link from "next/link";
import { ArrowRight, Euro, ShoppingBasket, Truck, Wallet } from "lucide-react";
import { TourProgress } from "@/components/deliveries/tour-progress";
import { KpiCard } from "@/components/metrics/kpi-card";
import { PeriodForm } from "@/components/metrics/period-form";
import { TaxModeSwitch } from "@/components/metrics/tax-mode-switch";
import { OrdersCards } from "@/components/orders/orders-cards";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { countOrders, getOrderStats, getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import {
  todayInParis,
  tourProgressFromCounts,
} from "@/domain/deliveries/rules";
import {
  applyTaxMode,
  METRIC_PERIOD_LABELS,
  periodRange,
  TAX_MODE_LABELS,
} from "@/domain/metrics/rules";
import { parsePeriodQuery } from "@/domain/metrics/schemas";
import { assignmentOptions } from "@/domain/staff/rules";
import { formatDateFr, formatEuros } from "@/lib/format";

/*
 * Tableau de bord, route « / » : l'activité
 * de la période choisie (défaut : aujourd'hui, mêmes périodes prédéfinies et
 * plage libre que les métriques) et ce qui attend une action, toutes dates.
 * Les chiffres de la période sont agrégés par la base (getOrderStats : une
 * requête, quelques nombres) puis mis en forme par les règles pures ; montants
 * HT par défaut, TTC par l'interrupteur (même URL ?tva= que les métriques).
 * Sous les KPI, la barre d'avancement des commandes de la période
 * (TourProgress, la même que la tournée : segments par statut, légende chiffrée).
 * En bas, les commandes en préparation toutes dates : le nombre (compté par la
 * base) et les PREPARING_SHOWN créneaux les plus proches, jamais la liste
 * entière (elle grandit avec l'activité) ; le lien mène à la liste complète.
 */
const PREPARING_SHOWN = 10;

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

  const [stats, preparing, preparingCount, user, staff] = await Promise.all([
    getOrderStats(range),
    getOrders({ status: "preparing" }, { limit: PREPARING_SHOWN }),
    countOrders({ status: "preparing" }),
    getCurrentUser(),
    listStaff(),
  ]);
  const { kpis } = stats;
  const delivering = stats.statusCounts.delivering;
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

      <div className="grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
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
          tone="brand"
        />
        <KpiCard
          label={`Panier moyen ${taxLabel}`}
          value={money(kpis.averageBasketCents)}
          icon={<Wallet />}
        />
        <KpiCard
          label="Expédiées"
          value={String(delivering)}
          hint="en cours de livraison"
          icon={<Truck />}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">
            Avancement des commandes :{" "}
            {query.customRange ? "période choisie" : title.toLowerCase()}
          </h2>
          {kpis.orderCount > 0 ? (
            <TourProgress
              progress={tourProgressFromCounts(stats.statusCounts)}
              label="Avancement des commandes de la période"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucune commande sur la période.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 @xl/main:flex-row @xl/main:flex-wrap">
        <Button
          variant="outline"
          className="justify-between @xl/main:justify-center"
          render={<Link href="/commandes?statut=preparing" />}
        >
          Commandes en préparation
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          className="justify-between @xl/main:justify-center"
          render={<Link href="/livraisons" />}
        >
          Tournée du jour
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          className="justify-between @xl/main:justify-center"
          render={<Link href="/metriques" />}
        >
          Métriques
          <ArrowRight />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Commandes en préparation ({preparingCount}, toutes dates)
        </h2>
        {preparingCount > preparing.length ? (
          <p className="text-muted-foreground text-sm">
            Les {preparing.length} créneaux les plus proches.{" "}
            <Link
              href="/commandes?statut=preparing"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Voir les {preparingCount} commandes en préparation
            </Link>
          </p>
        ) : null}
        {preparing.length > 0 ? (
          <OrdersCards
            orders={preparing}
            canChangeStatus={canChangeOrderStatus(user.role)}
            canAssign={canAssignStaff(user.role)}
            options={assignmentOptions(staff)}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucune commande en préparation.
          </p>
        )}
      </div>
    </>
  );
}
