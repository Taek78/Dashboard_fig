import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/* Chargement de /livraisons : sélecteur de jour, raccourcis, cartes horizontales. */
const ROWS = [1, 2, 3];

export default function LivraisonsLoading() {
  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournée du jour : suivez chaque livraison et faites avancer son statut."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement de la tournée…</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-1.5 sm:w-48">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-8 w-full sm:w-20" />
        </div>
        <Skeleton className="h-6 w-80 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-2xl ring-1 md:flex-row"
            >
              <div className="bg-muted/40 flex flex-row items-center gap-4 border-b p-4 md:w-52 md:flex-col md:items-start md:border-r md:border-b-0 md:p-5">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-5 w-24 rounded-4xl" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
                <Skeleton className="h-5 w-40" />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Skeleton className="h-10 w-full sm:w-40" />
                  <Skeleton className="h-10 w-full sm:w-32" />
                </div>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-44" />
              </div>
              <div className="flex flex-col justify-center gap-3 border-t p-4 md:w-80 md:border-t-0 md:border-l md:p-5">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-7 w-36" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
