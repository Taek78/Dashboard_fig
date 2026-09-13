import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
 * Chargement de /commandes/[id]. Le titre est inconnu : on reproduit la structure
 * de PageHeader sans l'utiliser, puis la même grille que OrderDetail avec des Card
 * réelles (mêmes col-span / row-span) pour que le cadre ne bouge pas à l'arrivée
 * des données. Pas d'error.tsx ici : celui de commandes/ couvre le segment enfant.
 */
const ROWS = [1, 2, 3];

export default function CommandeLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">Chargement de la commande…</p>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-64" />
          <span
            aria-hidden="true"
            className="bg-gradient-brand h-1 w-10 rounded-full"
          />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-7 w-44" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {["Client", "Livraison"].map((card) => (
          <Card key={card}>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}

        <Card className="lg:row-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-24 rounded-4xl" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Produit</TableHead>
                  <TableHead scope="col" className="text-right">
                    Quantité
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-14" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
