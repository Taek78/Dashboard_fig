import Link from "next/link";
import { ArrowRight, Clock, Euro, ShoppingBasket, Truck } from "lucide-react";
import { KpiCard } from "@/components/metrics/kpi-card";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getOrders } from "@/data/orders";
import { todayInParis } from "@/domain/deliveries/rules";
import { computeKpis } from "@/domain/metrics/rules";
import { formatDateFr, formatEuros } from "@/lib/format";

/*
 * Tableau de bord, route « / » (A6) : l'activité du jour et ce qui attend une
 * action. Chiffres calculés par les fonctions pures de metrics.
 */
export default async function TableauDeBordPage() {
  const today = todayInParis(new Date());
  const [orders, pending] = await Promise.all([
    getOrders({ date: today }),
    getOrders({ status: "pending" }),
  ]);
  const kpis = computeKpis(orders);
  const delivering = orders.filter((o) => o.status === "delivering").length;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`Activité du ${formatDateFr(today)}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Commandes du jour"
          value={String(kpis.orderCount)}
          hint={`${kpis.cancelledCount} annulée${kpis.cancelledCount > 1 ? "s" : ""}`}
          icon={<ShoppingBasket />}
        />
        <KpiCard
          label="CA du jour"
          value={formatEuros(kpis.revenueCents)}
          hint="hors annulées"
          icon={<Euro />}
        />
        <KpiCard
          label="À confirmer"
          value={String(pending.length)}
          hint="toutes dates"
          icon={<Clock />}
        />
        <KpiCard
          label="En livraison aujourd'hui"
          value={String(delivering)}
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
        <h2 className="text-base font-medium">Commandes à confirmer</h2>
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
