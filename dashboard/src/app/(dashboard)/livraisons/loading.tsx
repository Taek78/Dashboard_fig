import { OrdersFiltersSkeleton } from "@/components/orders/orders-filters";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Chargement de /livraisons : recherche et filtres, raccourcis des 7 derniers
 * jours, avancement de la période, en-tête d'un jour et cartes (même grille et
 * mêmes seuils de largeur de contenu que DeliveryCard).
 */
const SHORTCUTS = [1, 2, 3, 4, 5, 6, 7, 8];
const ROWS = [1, 2, 3];

export default function LivraisonsLoading() {
  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournées : suivez chaque livraison et faites avancer son statut."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement de la tournée…</p>
        <OrdersFiltersSkeleton />
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-4 w-28" />
          {SHORTCUTS.map((shortcut) => (
            <Skeleton key={shortcut} className="h-6 w-20" />
          ))}
        </div>
        <Skeleton className="h-4 w-56" />
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-baseline justify-between gap-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-7 w-14" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-6 w-56" />
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl ring-1 @xl/main:grid-cols-2 @4xl/main:grid-cols-[13rem_minmax(0,1fr)_20rem]"
            >
              <div className="bg-muted/40 flex flex-row items-center gap-4 border-b p-4 @xl/main:col-span-2 @xl/main:p-5 @4xl/main:col-span-1 @4xl/main:flex-col @4xl/main:items-start @4xl/main:border-r @4xl/main:border-b-0">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-7 w-28 rounded-4xl" />
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 @xl/main:p-5">
                <Skeleton className="h-5 w-40" />
                <div className="flex flex-col gap-2 @xl/main:flex-row">
                  <Skeleton className="h-10 w-full @xl/main:w-40" />
                  <Skeleton className="h-10 w-full @xl/main:w-32" />
                </div>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-44" />
              </div>
              <div className="flex flex-col justify-center gap-3 border-t p-4 @xl/main:border-t-0 @xl/main:border-l @xl/main:p-5">
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
