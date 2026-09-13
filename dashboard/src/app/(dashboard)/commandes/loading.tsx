import { tableFrame } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/*
 * État de chargement de /commandes. Next l'affiche automatiquement pendant que
 * page.tsx attend getOrders() (frontière Suspense). Composant serveur.
 * On reproduit la grille du tableau (même enveloppe, mêmes en-têtes, mêmes classes
 * de colonnes) pour éviter un saut de mise en page quand les données arrivent.
 */
const hideOnMobile = "hidden md:table-cell";
const numeric = "text-right tabular-nums";
const ROWS = [1, 2, 3, 4, 5, 6];

export default function CommandesLoading() {
  return (
    <>
      <PageHeader
        title="Commandes"
        description="Suivez et préparez les commandes à livrer."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement des commandes…</p>
        {/* Silhouette de la barre de filtres : loading.tsx ne connaît pas l'URL. */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="grid gap-1.5 md:w-48">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="grid gap-1.5 md:w-48">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-4 w-28" />
        <div className={tableFrame}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Référence</TableHead>
                <TableHead scope="col">Client</TableHead>
                <TableHead scope="col">Créneau</TableHead>
                <TableHead scope="col" className={hideOnMobile}>
                  Ville
                </TableHead>
                <TableHead scope="col" className={`${hideOnMobile} ${numeric}`}>
                  Articles
                </TableHead>
                <TableHead scope="col" className={numeric}>
                  Total
                </TableHead>
                <TableHead scope="col">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell className={hideOnMobile}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={`${hideOnMobile} ${numeric}`}>
                    <Skeleton className="ml-auto h-4 w-6" />
                  </TableCell>
                  <TableCell className={numeric}>
                    <Skeleton className="ml-auto h-4 w-14" />
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
    </>
  );
}
