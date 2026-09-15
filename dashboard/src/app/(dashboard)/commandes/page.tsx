import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { OrdersCards } from "@/components/orders/orders-cards";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canAssignStaff, canChangeOrderStatus } from "@/domain/auth/roles";
import {
  hasOrderFilters,
  orderFiltersQuery,
  paginate,
  sortOrdersBySlot,
} from "@/domain/orders/rules";
import { parseOrderFilters, parsePage } from "@/domain/orders/schemas";
import { assignmentOptions, staffFilterOptions } from "@/domain/staff/rules";
import { formatOrdersCount } from "@/lib/format";
import { readSimulationMode } from "@/lib/simulation";

/*
 * Liste des commandes. Composant serveur async : lit l'URL une fois, en tire le
 * mode de simulation (dev seulement), les filtres validés et la page, charge via
 * la façade (@/data/orders, jamais le mock) avec l'équipe (pour les listes
 * déroulantes d'affectation), puis rend la recherche et les filtres (OrdersFilters, partagés avec les
 * livraisons : référence, client, statut, période, équipe), le compteur, les
 * cartes de la page (les plus récentes d'abord, 40 par page) et la pagination,
 * ou l'un des deux états vides.
 *
 * Deux états vides : « rien ne correspond aux filtres » (proposer de réinitialiser)
 * et « aucune commande du tout » n'appellent pas la même action.
 */
export const metadata: Metadata = { title: "Commandes" };

const emptyMedia =
  "bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6";

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
  const isFiltered = hasOrderFilters(filters);
  const [orders, user, staff] = await Promise.all([
    mode === "vide" ? Promise.resolve([]) : getOrders(filters),
    getCurrentUser(),
    listStaff(),
  ]);
  const options = assignmentOptions(staff);
  const page = paginate(sortOrdersBySlot(orders, "desc"), parsePage(raw));
  const baseParams = orderFiltersQuery(filters);

  return (
    <>
      <PageHeader
        title="Commandes"
        description="Suivez et préparez les commandes à livrer."
      />
      <div className="flex flex-col gap-4">
        <OrdersFilters
          action="/commandes"
          formLabel="Recherche et filtres des commandes"
          searchLabel="Rechercher une commande"
          filters={filters}
          staff={staffFilterOptions(staff)}
          canReset={isFiltered}
        />
        <p role="status" className="text-base font-semibold">
          {formatOrdersCount(page.total)}
          {page.pageCount > 1 ? (
            <span className="text-muted-foreground text-sm font-normal">
              {` · les plus récentes d'abord, page ${page.page} sur ${page.pageCount}`}
            </span>
          ) : null}
        </p>
        {orders.length > 0 ? (
          <>
            <OrdersCards
              orders={page.items}
              canChangeStatus={canChangeOrderStatus(user.role)}
              canAssign={canAssignStaff(user.role)}
              options={options}
            />
            <OrdersPagination page={page} baseParams={baseParams} />
          </>
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
