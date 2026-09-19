import Link from "next/link";
import { SearchX } from "lucide-react";
import { CommunityCard } from "@/components/customers/community-card";
import { CustomerCard } from "@/components/customers/customer-card";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { listCommunities } from "@/data/communities";
import { getCustomers } from "@/data/customers";
import { getDirectoryStats } from "@/data/orders";
import {
  buildDirectory,
  countDirectory,
  DIRECTORY_PAGE_SIZE,
  directorySearchQuery,
  filterDirectory,
  sortDirectory,
} from "@/domain/customers/directory";
import type { ClientsSearch } from "@/domain/customers/schemas";
import { paginate } from "@/domain/orders/rules";

/*
 * Résultats de la recherche commune (serveur async, dans un <Suspense> de la
 * page : seul ce bloc affiche son squelette pendant la recherche).
 * Particuliers et communautés en grandes cartes ; leurs chiffres (commandes,
 * montants, fidélité) sont agrégés par la base (getDirectoryStats), puis
 * filtrés et triés par les règles pures de l'annuaire, DIRECTORY_PAGE_SIZE par page ; chaque carte mène
 * à sa fiche par un bouton dédié.
 */
export async function CustomersResults({
  search,
  showSpending = true,
}: {
  search: ClientsSearch;
  /** Faux pour le livreur : ni montant dépensé ni remises sur les cartes. */
  showSpending?: boolean;
}) {
  const [customers, communities, stats] = await Promise.all([
    getCustomers(),
    listCommunities(),
    getDirectoryStats(),
  ]);
  // La catégorie d'un client dépend de l'instant : celui de la lecture.
  const now = new Date().toISOString();
  const entries = sortDirectory(
    filterDirectory(buildDirectory(customers, communities, stats, now), search),
    search.sort,
    search.order,
  );
  const page = paginate(entries, search.page, DIRECTORY_PAGE_SIZE);
  const counts = countDirectory(entries);
  const scope = search.query ? ` pour « ${search.query} »` : "";
  const plural = (n: number) => (n > 1 ? "s" : "");

  if (entries.length === 0) {
    return (
      <Empty className="bg-card/60 min-h-[30vh] rounded-none border border-dashed">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
          >
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Aucun résultat{scope}</EmptyTitle>
          <EmptyDescription>
            Essayez un autre nom, une partie de l&apos;e-mail, une ville, le nom
            d&apos;une communauté ou les derniers chiffres du téléphone.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link
            href="/clients"
            className={buttonVariants({ variant: "outline" })}
          >
            Voir tous les clients
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-base font-semibold">
        {entries.length} résultat{plural(entries.length)}
        {scope}
        <span className="text-muted-foreground text-sm font-normal">
          {` · ${counts.communities} communauté${plural(counts.communities)} · ${counts.customers} client${plural(counts.customers)}`}
          {page.pageCount > 1
            ? ` · page ${page.page} sur ${page.pageCount}`
            : ""}
        </span>
      </p>
      <ul className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {page.items.map((entry) => (
          <li key={`${entry.kind}-${entry.id}`}>
            {entry.kind === "community" ? (
              <CommunityCard entry={entry} showSpending={showSpending} />
            ) : (
              <CustomerCard entry={entry} showSpending={showSpending} />
            )}
          </li>
        ))}
      </ul>
      <OrdersPagination
        page={page}
        baseParams={directorySearchQuery(search)}
        path="/clients"
      />
    </div>
  );
}

const CARDS = [1, 2, 3, 4, 5, 6];

/** Squelette des résultats : même grille, mêmes cartes, annonce du chargement. */
export function CustomersResultsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p role="status" className="text-muted-foreground text-sm">
        Recherche en cours…
      </p>
      <ul className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {CARDS.map((card) => (
          <li
            key={card}
            className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-none p-4 ring-1 @2xl/main:p-5"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-28 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 w-full rounded-none" />
            <Skeleton className="h-9 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
