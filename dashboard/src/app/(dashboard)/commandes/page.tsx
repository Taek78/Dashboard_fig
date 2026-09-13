import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrdersCards } from "@/components/orders/orders-cards";
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
import { canChangeOrderStatus } from "@/domain/auth/roles";
import { parseOrderFilters } from "@/domain/orders/schemas";
import { formatOrdersCount } from "@/lib/format";
import { readSimulationMode } from "@/lib/simulation";

/*
 * Liste des commandes. Composant serveur async : lit l'URL une fois, en tire le
 * mode de simulation (dev seulement) et les filtres validés, charge via la façade
 * (@/data/orders, jamais le mock), rend la barre de filtres, le compteur et les
 * cartes (même présentation que la tournée, avec les actions) ou l'un des deux
 * états vides.
 *
 * Deux états vides : « rien ne correspond aux filtres » (proposer de réinitialiser)
 * et « aucune commande du tout » n'appellent pas la même action.
 * Un tableau vide est « vrai » en JS : on teste orders.length, pas orders.
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
  const isFiltered = filters.status !== undefined || filters.date !== undefined;
  const [orders, user] = await Promise.all([
    mode === "vide" ? Promise.resolve([]) : getOrders(filters),
    getCurrentUser(),
  ]);

  return (
    <>
      <PageHeader
        title="Commandes"
        description="Suivez et préparez les commandes à livrer."
      />
      <div className="flex flex-col gap-4">
        <OrdersFilters filters={filters} />
        <p role="status" className="text-muted-foreground text-sm">
          {formatOrdersCount(orders.length)}
        </p>
        {orders.length > 0 ? (
          <OrdersCards
            orders={orders}
            canChangeStatus={canChangeOrderStatus(user.role)}
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
