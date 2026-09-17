import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { DeliveryDayShortcuts } from "@/components/orders/delivery-day-shortcuts";
import { OrdersCards } from "@/components/orders/orders-cards";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { PageHeader } from "@/components/page-header";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getDeliveryDayCounts, getOrdersPage } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import {
  RECENT_DAYS,
  recentDeliveryDaysFromCounts,
  todayInParis,
} from "@/domain/deliveries/rules";
import {
  hasOrderFilters,
  orderFiltersQuery,
  type Page,
} from "@/domain/orders/rules";
import {
  parseOrderFilters,
  parsePage,
  parsePeriodInput,
} from "@/domain/orders/schemas";
import type { Order } from "@/domain/orders/types";
import { assignmentOptions, staffFilterOptions } from "@/domain/staff/rules";
import { addDays } from "@/lib/days";
import { endSentence, formatOrdersCount, formatPeriodFr } from "@/lib/format";
import { readSimulationMode } from "@/lib/simulation";

/*
 * Liste des commandes, qui sert aussi de tournée depuis que la section
 * Livraisons y a été fondue (2026-09-16). Composant serveur async : lit l'URL
 * une fois, en tire le mode de simulation (dev seulement), les filtres
 * validés, la saisie de période et la page, puis demande à la façade
 * (@/data/orders) UNE page : la base filtre, cherche, compte et découpe (40
 * commandes, les plus récentes d'abord) au lieu de charger tout l'historique.
 * Avec l'équipe (pour les listes déroulantes d'affectation), la page rend la
 * recherche et les filtres (référence, client, statut, période, équipe), les
 * raccourcis des RECENT_DAYS derniers jours (chacun avec son nombre de
 * livraisons, compté par la base, en gardant la recherche en cours), le
 * compteur, les cartes et la pagination, ou l'un des états vides.
 *
 * Trois états vides : une période sans commande (bandeau bleu, la période
 * était valide, il n'y a juste rien ce jour-là), « rien ne correspond aux
 * filtres » (proposer de réinitialiser) et « aucune commande du tout ».
 */
export const metadata: Metadata = { title: "Commandes" };

const emptyMedia =
  "bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6";

const EMPTY_PAGE: Page<Order> = { items: [], page: 1, pageCount: 1, total: 0 };

export default async function CommandesPage({
  searchParams,
}: PageProps<"/commandes">) {
  const raw = await searchParams;
  const mode = readSimulationMode(
    raw.simuler,
    process.env.NODE_ENV === "development",
  );
  if (mode === "erreur") throw new Error("Simulation d'erreur");

  const filters = parseOrderFilters(raw);
  const period = parsePeriodInput(raw);
  const isFiltered = hasOrderFilters(filters) || period.error !== null;
  const today = todayInParis(new Date());
  const weekStart = addDays(today, -(RECENT_DAYS - 1));
  const [page, dayCounts, user, staff] = await Promise.all([
    mode === "vide"
      ? Promise.resolve(EMPTY_PAGE)
      : getOrdersPage(filters, parsePage(raw)),
    getDeliveryDayCounts({ from: weekStart, to: today }),
    getCurrentUser(),
    listStaff(),
  ]);
  const options = assignmentOptions(staff);
  const baseParams = orderFiltersQuery(filters);
  const withoutDates = orderFiltersQuery({
    ...filters,
    from: undefined,
    to: undefined,
  });

  return (
    <>
      <PageHeader title="Commandes" />
      <div className="flex flex-col gap-4">
        <OrdersFilters
          filters={filters}
          period={period}
          staff={staffFilterOptions(staff)}
          canReset={isFiltered}
        />
        <DeliveryDayShortcuts
          days={recentDeliveryDaysFromCounts(dayCounts, today)}
          today={today}
          weekStart={weekStart}
          filters={filters}
        />
        <p role="status" className="text-base font-semibold">
          {formatOrdersCount(page.total)}
          {period.range ? (
            <span className="text-muted-foreground text-sm font-normal">
              {` · livraison ${formatPeriodFr(period.range.from, period.range.to)}`}
            </span>
          ) : null}
          {page.pageCount > 1 ? (
            <span className="text-muted-foreground text-sm font-normal">
              {` · les plus récentes d'abord, page ${page.page} sur ${page.pageCount}`}
            </span>
          ) : null}
        </p>
        {page.total > 0 ? (
          <>
            <OrdersCards
              orders={page.items}
              canChangeStatus={canChangeOrderStatus(user.role)}
              canAssign={canAssignStaff(user.role)}
              options={options}
            />
            <OrdersPagination page={page} baseParams={baseParams} />
          </>
        ) : period.range ? (
          <PeriodEmptyNotice
            text={endSentence(
              `Aucune commande livrée ${formatPeriodFr(period.range.from, period.range.to)}${
                withoutDates ? " avec ces filtres" : ""
              }`,
            )}
            resetHref={
              withoutDates ? `/commandes?${withoutDates}` : "/commandes"
            }
          />
        ) : isFiltered ? (
          <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Aucune commande ne correspond</EmptyTitle>
              <EmptyDescription>
                Modifiez les filtres ou réinitialisez-les pour revoir toutes les
                commandes.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" render={<Link href="/commandes" />}>
                Réinitialiser les filtres
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Aucune commande</EmptyTitle>
              <EmptyDescription>
                Les commandes passées dans l&apos;application FIG apparaîtront
                ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  );
}
