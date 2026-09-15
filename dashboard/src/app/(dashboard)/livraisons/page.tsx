import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, TriangleAlert } from "lucide-react";
import { TourCards } from "@/components/deliveries/tour-cards";
import { TourProgress } from "@/components/deliveries/tour-progress";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getDeliveryDayCounts, getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import {
  groupOrdersByDay,
  recentDeliveryDaysFromCounts,
  TOUR_MAX_DAYS,
  todayInParis,
  tourProgress,
  tourRange,
} from "@/domain/deliveries/rules";
import { hasOrderFilters, orderFiltersQuery } from "@/domain/orders/rules";
import { parseOrderFilters } from "@/domain/orders/schemas";
import type { OrderFilters } from "@/domain/orders/types";
import { assignmentOptions, staffFilterOptions } from "@/domain/staff/rules";
import { addDays } from "@/lib/days";
import { formatDateFr, formatDayLongFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Livraisons : les tournées d'une période (aujourd'hui en Europe/Paris par
 * défaut, TOUR_MAX_DAYS jours au plus), groupées par jour, en cartes de terrain
 * (ordre de passage, appel, itinéraire, geste suivant en un bouton).
 * Composant serveur :
 * - même recherche et mêmes filtres que les commandes (parseOrderFilters) ; la
 *   période effective vient de tourRange, qui signale une période ramenée ;
 * - raccourcis sur les 7 derniers jours, chacun avec son nombre de livraisons
 *   (compté par la base, getDeliveryDayCounts), qui gardent la recherche en cours ;
 * - avancement détaillé par statut pour la période, puis pour chaque jour.
 */
export const metadata: Metadata = { title: "Livraisons" };

const plural = (n: number) => (n > 1 ? "s" : "");

export default async function LivraisonsPage({
  searchParams,
}: PageProps<"/livraisons">) {
  const filters = parseOrderFilters(await searchParams);
  const today = todayInParis(new Date());
  const range = tourRange(filters, today);
  const effective: OrderFilters = {
    ...filters,
    from: range.from,
    to: range.to,
  };
  const weekStart = addDays(today, -(TOUR_MAX_DAYS - 1));

  const [orders, dayCounts, user, staff] = await Promise.all([
    getOrders(effective),
    getDeliveryDayCounts({ from: weekStart, to: today }),
    getCurrentUser(),
    listStaff(),
  ]);
  const groups = groupOrdersByDay(orders);
  const days = recentDeliveryDaysFromCounts(dayCounts, today);
  const singleDay = range.from === range.to;
  const isWeek = range.from === weekStart && range.to === today;
  const shortcut = (from: string, to: string) =>
    `/livraisons?${orderFiltersQuery({ ...filters, from, to })}`;
  const period = singleDay
    ? formatDayLongFr(range.from)
    : `du ${formatDateFr(range.from)} au ${formatDateFr(range.to)}`;

  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournées : suivez chaque livraison et faites avancer son statut."
      />
      <div className="flex flex-col gap-4">
        <OrdersFilters
          action="/livraisons"
          formLabel="Recherche et filtres des livraisons"
          searchLabel="Rechercher une livraison"
          filters={effective}
          staff={staffFilterOptions(staff)}
          canReset={hasOrderFilters(filters)}
          rangeHelp={`Sans date : la tournée du jour. Période de ${TOUR_MAX_DAYS} jours au plus.`}
        />

        <nav
          aria-label={`${TOUR_MAX_DAYS} derniers jours`}
          className="flex flex-wrap items-center gap-1.5 text-sm"
        >
          <span className="text-muted-foreground mr-1">
            {TOUR_MAX_DAYS} derniers jours :
          </span>
          <Link
            href={shortcut(weekStart, today)}
            aria-current={isWeek ? "true" : undefined}
            className={buttonVariants({
              size: "xs",
              variant: isWeek ? "secondary" : "outline",
            })}
          >
            Les {TOUR_MAX_DAYS} jours
          </Link>
          {days.map((day) => {
            const current = singleDay && range.from === day.date;
            return (
              <Link
                key={day.date}
                href={shortcut(day.date, day.date)}
                aria-current={current ? "date" : undefined}
                className={cn(
                  buttonVariants({
                    size: "xs",
                    variant: current ? "secondary" : "ghost",
                  }),
                  day.count === 0 && !current && "text-muted-foreground",
                )}
              >
                {day.date === today ? "Aujourd'hui" : formatDateFr(day.date)}
                <span className="bg-muted text-foreground rounded-full px-1.5 text-[0.7rem] leading-4 tabular-nums">
                  {day.count}
                </span>
                <span className="sr-only"> livraison{plural(day.count)}</span>
              </Link>
            );
          })}
        </nav>

        {range.clamped ? (
          <p className="text-warning flex items-center gap-2 text-sm font-medium">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            Période ramenée à {TOUR_MAX_DAYS} jours : du{" "}
            {formatDateFr(range.from)} au {formatDateFr(range.to)}.
          </p>
        ) : null}

        <p
          role="status"
          className="text-base font-semibold first-letter:uppercase"
        >
          {period} : {orders.length} livraison{plural(orders.length)}
        </p>

        {orders.length > 0 ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <h2 className="text-muted-foreground text-sm font-medium">
                  {singleDay
                    ? "Avancement de la tournée"
                    : "Avancement de la période"}
                </h2>
                <TourProgress
                  progress={tourProgress(orders)}
                  label="Avancement de la tournée"
                />
              </CardContent>
            </Card>
            <TourCards
              groups={groups}
              canChangeStatus={canChangeOrderStatus(user.role)}
              canAssign={canAssignStaff(user.role)}
              options={assignmentOptions(staff)}
            />
          </>
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
              >
                <CalendarX2 />
              </EmptyMedia>
              <EmptyTitle>
                {singleDay
                  ? "Aucune livraison ce jour"
                  : "Aucune livraison sur cette période"}
              </EmptyTitle>
              <EmptyDescription>
                Changez de période, choisissez l&apos;un des {TOUR_MAX_DAYS}{" "}
                derniers jours ou élargissez la recherche.
              </EmptyDescription>
            </EmptyHeader>
            {hasOrderFilters(filters) ? (
              <EmptyContent>
                <Link
                  href="/livraisons"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Revenir à la tournée du jour
                </Link>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </div>
    </>
  );
}
