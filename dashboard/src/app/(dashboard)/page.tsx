import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarX2,
  Euro,
  ShoppingBasket,
  Truck,
  Wallet,
} from "lucide-react";
import { DashboardClock } from "@/components/dashboard-clock";
import { SimulationButtons } from "@/components/demo/simulation-buttons";
import { TourProgress } from "@/components/deliveries/tour-progress";
import { KpiCard } from "@/components/metrics/kpi-card";
import { PeriodForm } from "@/components/metrics/period-form";
import { TaxModeSwitch } from "@/components/metrics/tax-mode-switch";
import { OrdersCards } from "@/components/orders/orders-cards";
import { PageHeader } from "@/components/page-header";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
import { Section } from "@/components/section";
import { StaffShortageAlert } from "@/components/staff/staff-shortage-alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { countOrders, getOrderStats, getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import {
  canAssignStaff,
  canChangeOrderStatus,
  canSeeRevenue,
} from "@/domain/auth/roles";
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
import { parsePeriodQuery, periodParams } from "@/domain/metrics/schemas";
import { assignmentOptions, unavailableRoles } from "@/domain/staff/rules";
import {
  endSentence,
  formatDateFr,
  formatEuros,
  formatPeriodFr,
} from "@/lib/format";
import { canUseDemoTools } from "@/lib/demo-tools";
import { cn } from "@/lib/utils";

/*
 * Tableau de bord, route « / » : EN PRIORITÉ l'alerte si aucun préparateur ou
 * aucun livreur n'est présent (rien ne peut être préparé ou livré), puis
 * l'activité de la période choisie (défaut : aujourd'hui, mêmes périodes
 * prédéfinies et période personnalisée que les métriques) et ce qui attend une
 * action,
 * toutes dates.
 * Les chiffres de la période sont agrégés par la base (getOrderStats : une
 * requête, quelques nombres) puis mis en forme par les règles pures ; montants
 * HT par défaut, TTC par l'interrupteur (même URL ?tva= que les métriques).
 * Sous les KPI, la barre d'avancement des commandes de la période
 * (TourProgress : segments par statut, légende chiffrée) ; sans commande, un
 * état vide bien visible (« Aucune commande »), et une période personnalisée sans
 * commande est dite par le bandeau bleu commun.
 * Le livreur (canSeeRevenue faux) ne voit AUCUN montant : ni CA ni panier
 * moyen (les cartes ne sont pas rendues, rien n'arrive au navigateur), ni
 * l'interrupteur HT / TTC, ni le raccourci vers les Métriques ; il garde
 * Commandes et Expédiées.
 * En bas, les commandes en préparation toutes dates : le nombre (compté par la
 * base) et les PREPARING_SHOWN créneaux les plus proches, jamais la liste
 * entière (elle grandit avec l'activité) ; le lien mène à la liste complète.
 */
const PREPARING_SHOWN = 10;

export default async function TableauDeBordPage({
  searchParams,
}: PageProps<"/">) {
  const query = parsePeriodQuery(await searchParams);
  const now = new Date();
  const today = todayInParis(now);
  const range = query.customRange ?? periodRange(query.period, today);
  const title = query.customRange
    ? `Du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`
    : METRIC_PERIOD_LABELS[query.period];
  const taxLabel = TAX_MODE_LABELS[query.tax];
  const money = (cents: number) => formatEuros(applyTaxMode(cents, query.tax));
  const baseParams = periodParams(query);

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
  const revenue = canSeeRevenue(user.role);
  const shortcuts = [
    ["/commandes?statut=preparing", "Commandes en préparation"],
    [`/commandes?du=${today}&au=${today}`, "Livraisons du jour"],
    ...(revenue ? [["/metriques", "Métriques"]] : []),
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={revenue ? `${title} · montants ${taxLabel}.` : title}
        actions={<DashboardClock initial={now.toISOString()} />}
      />

      {/* DÉVELOPPEMENT SEULEMENT, à retirer avant la livraison (docs/backlog.md). */}
      {canUseDemoTools(user.role) ? <SimulationButtons /> : null}

      <StaffShortageAlert roles={unavailableRoles(staff)} />

      <Card>
        <CardContent>
          <PeriodForm
            action="/"
            period={query.period}
            customPeriod={query.customPeriod}
            custom={query.custom}
            range={range}
            hiddenFields={{ tva: query.tax }}
            tools={
              revenue ? (
                <TaxModeSwitch
                  action="/"
                  tax={query.tax}
                  baseParams={baseParams}
                />
              ) : undefined
            }
          />
        </CardContent>
      </Card>

      <div
        className={cn(
          "grid grid-cols-2 gap-3 @xl/main:gap-4",
          revenue && "@4xl/main:grid-cols-4",
        )}
      >
        <KpiCard
          metric
          label="Commandes"
          value={String(kpis.orderCount)}
          hint={`${kpis.cancelledCount} annulée${plural(kpis.cancelledCount)}`}
          icon={<ShoppingBasket />}
        />
        {revenue ? (
          <>
            <KpiCard
              metric
              label={`CA ${taxLabel}`}
              value={money(kpis.revenueCents)}
              hint="hors annulées"
              icon={<Euro />}
              tone="brand"
            />
            <KpiCard
              metric
              label={`Panier moyen ${taxLabel}`}
              value={money(kpis.averageBasketCents)}
              icon={<Wallet />}
            />
          </>
        ) : null}
        <KpiCard
          metric
          label="Expédiées"
          value={String(delivering)}
          hint="en cours de livraison"
          icon={<Truck />}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Activity className="text-primary size-4" aria-hidden="true" />
            Avancement des commandes ·{" "}
            {query.customRange ? "période choisie" : title.toLowerCase()}
          </h2>
          {kpis.orderCount > 0 ? (
            <TourProgress
              progress={tourProgressFromCounts(stats.statusCounts)}
              label="Avancement des commandes de la période"
            />
          ) : query.customRange ? (
            <PeriodEmptyNotice
              text={endSentence(
                `Aucune commande livrée ${formatPeriodFr(range.from, range.to)}`,
              )}
              resetHref={`/?tva=${query.tax}`}
              resetLabel="Revenir à aujourd'hui"
            />
          ) : (
            <Empty className="bg-muted/30 border py-8">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
                >
                  <CalendarX2 />
                </EmptyMedia>
                <EmptyTitle className="text-lg font-semibold">
                  Aucune commande
                </EmptyTitle>
                <EmptyDescription>
                  {title} : rien à préparer ni à livrer. Choisissez une autre
                  période ci-dessus.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {/* De vrais liens habillés en bouton : ils NAVIGUENT, un <Button render> serait annoncé « bouton ». */}
      <nav
        aria-label="Raccourcis"
        className="flex flex-col gap-2 @xl/main:flex-row @xl/main:flex-wrap"
      >
        {shortcuts.map(([href, label]) => (
          <Link
            key={href}
            href={href!}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "justify-between @xl/main:justify-center",
            )}
          >
            {label}
            <ArrowRight />
          </Link>
        ))}
      </nav>

      <Section
        id="preparation"
        title={`Commandes en préparation (${preparingCount}, toutes dates)`}
        description={
          preparingCount > preparing.length
            ? `Les ${preparing.length} créneaux les plus proches.`
            : undefined
        }
        actions={
          preparingCount > preparing.length ? (
            <Link
              href="/commandes?statut=preparing"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Voir les {preparingCount} commandes
              <ArrowRight />
            </Link>
          ) : null
        }
      >
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
      </Section>
    </>
  );
}
