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

/* Chargement de /livraisons : même silhouette que la page (sélecteur de jour, raccourcis, tableau). */
const ROWS = [1, 2, 3, 4];

export default function LivraisonsLoading() {
  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournée du jour et attribution des livreurs."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement de la tournée…</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="grid gap-1.5 md:w-48">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-6 w-80" />
        <Skeleton className="h-4 w-56" />
        <div className={tableFrame}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Créneau</TableHead>
                <TableHead scope="col">Référence</TableHead>
                <TableHead scope="col">Client</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Ville
                </TableHead>
                <TableHead scope="col">Statut</TableHead>
                <TableHead scope="col">Livreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-4xl" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-56" />
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
