import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CustomersResults,
  CustomersResultsSkeleton,
} from "@/components/customers/customers-results";
import { CustomersSearch } from "@/components/customers/customers-search";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/data/session";
import { canSeeRevenue } from "@/domain/auth/roles";
import { directorySearchQuery } from "@/domain/customers/directory";
import { parseClientsSearch } from "@/domain/customers/schemas";

/*
 * Clients : une recherche commune pour les particuliers et les communautés
 * (?q=), un commutateur de type (?type=) et un tri dans les deux sens (?tri=),
 * puis les résultats en grandes cartes paginées (?page=), chacune avec son
 * bouton vers la fiche.
 * Les résultats chargent dans leur propre <Suspense> : la recherche reste en
 * place pendant le chargement (pas de loading.tsx pour ce segment, c'est
 * voulu). Pas de key sur la Suspense : la recherche automatique navigue dans
 * une transition, les résultats précédents restent affichés jusqu'aux
 * suivants au lieu de clignoter en squelette à chaque frappe (le squelette ne
 * sert qu'au premier chargement).
 * Un rôle qui ne voit pas l'argent (livreur, canSeeRevenue) n'a ni le montant
 * dépensé ni les remises sur les cartes, ni le tri par montant.
 */
export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: PageProps<"/clients">) {
  const user = await getCurrentUser();
  const showSpending = canSeeRevenue(user.role);
  const search = parseClientsSearch(await searchParams, showSpending);
  const canReset = directorySearchQuery(search) !== "";

  return (
    <>
      <PageHeader title="Clients" />
      <CustomersSearch
        search={search}
        canReset={canReset}
        showSpending={showSpending}
      />
      <Suspense fallback={<CustomersResultsSkeleton />}>
        <CustomersResults search={search} showSpending={showSpending} />
      </Suspense>
    </>
  );
}
