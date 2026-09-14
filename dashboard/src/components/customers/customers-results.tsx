import Link from "next/link";
import { SearchX } from "lucide-react";
import { CustomersTable } from "@/components/customers/customers-table";
import { mobileCardFrame, tableFrame } from "@/components/orders/orders-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomers } from "@/data/customers";
import { getOrders } from "@/data/orders";
import { loyaltyStatus, type LoyaltyStatus } from "@/domain/customers/loyalty";
import type { CustomerSearch } from "@/domain/customers/schemas";
import { filterOrders } from "@/domain/orders/rules";
import { cn } from "@/lib/utils";

/*
 * Zone de résultats des particuliers, composant serveur ASYNC rendu dans un
 * <Suspense> par la page : pendant la recherche, seul ce bloc affiche son
 * squelette (CustomersResultsSkeleton), le moteur de recherche au-dessus reste
 * en place. Les commandes sont chargées une fois pour calculer la série de
 * fidélité de chaque client listé (règle pure loyaltyStatus).
 */
export async function CustomersResults({ search }: { search: CustomerSearch }) {
  const [customers, orders] = await Promise.all([
    getCustomers({ query: search.query, membership: "individual" }),
    getOrders(),
  ]);
  const loyalty = new Map<string, LoyaltyStatus>(
    customers.map((c) => [
      c.id,
      loyaltyStatus(filterOrders(orders, { customerId: c.id })),
    ]),
  );
  const count = customers.length;
  const scope = search.query ? ` pour « ${search.query} »` : "";

  if (count === 0) {
    return (
      <Empty className="bg-card/60 min-h-[30vh] rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
          >
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Aucun client{scope}</EmptyTitle>
          <EmptyDescription>
            Essayez un autre nom, une partie de l&apos;e-mail ou les derniers
            chiffres du téléphone. Les membres d&apos;une communauté sont dans
            l&apos;onglet Communautés.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" render={<Link href="/clients?tous=1" />}>
            Afficher tous les particuliers
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        {count} client{count > 1 ? "s" : ""}
        {scope}
      </p>
      <CustomersTable
        customers={customers}
        loyalty={loyalty}
        showCommunity={false}
      />
    </div>
  );
}

const ROWS = [1, 2, 3, 4];

/** Squelette de la zone de résultats : même cadre, même en-tête, annonce sr-only. */
export function CustomersResultsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        Recherche en cours…
      </p>
      <ul className="flex flex-col gap-3 md:hidden">
        {ROWS.map((row) => (
          <li key={row} className={mobileCardFrame}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
      <div className={cn(tableFrame, "hidden md:block")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Nom</TableHead>
              <TableHead scope="col">E-mail</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Téléphone
              </TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Ville
              </TableHead>
              <TableHead scope="col">Fidélité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-4xl" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
