import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CommunitiesCards,
  CommunitiesCardsSkeleton,
} from "@/components/customers/communities-cards";
import { CustomerTabs } from "@/components/customers/customer-tabs";
import {
  CustomersResults,
  CustomersResultsSkeleton,
} from "@/components/customers/customers-results";
import { CustomersSearch } from "@/components/customers/customers-search";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { parseCustomerSearch } from "@/domain/customers/schemas";

/*
 * Clients et support, en deux onglets (?type=) :
 * - particuliers : le moteur de recherche, sans liste tant que l'utilisateur
 *   n'a pas cherché (?q=) ou demandé « tous » (?tous=1) ; les résultats
 *   portent la série de fidélité de chacun ;
 * - communautés : les groupes de clients livrés à un même point de retrait,
 *   avec leur remise, en cartes.
 * Chaque zone charge dans son propre <Suspense> : la page ne fait aucun
 * await de données elle-même (pas de loading.tsx pour ce segment, c'est
 * voulu). La key force un nouveau squelette à chaque nouvelle recherche.
 */
export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: PageProps<"/clients">) {
  const search = parseCustomerSearch(await searchParams);
  const showResults = search.all || search.query !== undefined;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Particuliers et communautés : historique de commandes, fidélité, notes internes."
        actions={
          search.tab === "particuliers" && showResults ? (
            <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
              Nouvelle recherche
            </Button>
          ) : undefined
        }
      />
      <CustomerTabs current={search.tab} />
      {search.tab === "communautes" ? (
        <Suspense fallback={<CommunitiesCardsSkeleton />}>
          <CommunitiesCards />
        </Suspense>
      ) : (
        <>
          <CustomersSearch query={search.query} />
          {showResults ? (
            <Suspense
              key={`${search.query ?? ""}|${search.all}`}
              fallback={<CustomersResultsSkeleton />}
            >
              <CustomersResults search={search} />
            </Suspense>
          ) : null}
        </>
      )}
    </>
  );
}
