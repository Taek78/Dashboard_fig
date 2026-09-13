import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CustomersResults,
  CustomersResultsSkeleton,
} from "@/components/customers/customers-results";
import { CustomersSearch } from "@/components/customers/customers-search";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { parseCustomerSearch } from "@/domain/customers/schemas";

/*
 * Clients et support (A5, revu le 2026-09-13) : la page s'ouvre sur le moteur de
 * recherche, sans liste. Les résultats n'apparaissent qu'avec ?q= ou ?tous=1,
 * dans un <Suspense> propre : la page ne fait aucun await de données elle-même,
 * donc le moteur reste affiché pendant que la zone de résultats charge (pas de
 * loading.tsx pour ce segment, c'est voulu). La key force un nouveau squelette à
 * chaque nouvelle recherche.
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
        description="Retrouvez un client, son historique de commandes et ses notes internes."
        actions={
          showResults ? (
            <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
              Nouvelle recherche
            </Button>
          ) : undefined
        }
      />
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
  );
}
