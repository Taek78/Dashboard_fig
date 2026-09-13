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

const ROWS = [1, 2, 3, 4, 5, 6];

export default function CatalogueLoading() {
  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Produits, prix et stocks proposés dans l'application."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement du catalogue…</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Skeleton className="h-8 w-full md:w-56" />
          <Skeleton className="h-8 w-full md:w-44" />
          <Skeleton className="h-8 w-full md:w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-4 w-24" />
        <div className={tableFrame}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Produit</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Catégorie
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Prix
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Stock
                </TableHead>
                <TableHead scope="col">Disponibilité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-4xl" />
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
