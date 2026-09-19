import { OrdersFiltersSkeleton } from "@/components/orders/orders-filters-skeleton";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * État de chargement de /commandes. Next l'affiche automatiquement pendant que
 * page.tsx attend la base (frontière Suspense). Composant serveur.
 * On reproduit la silhouette de la recherche (raccourcis des 7 derniers jours
 * compris), de la barre d'avancement et des cartes (même grille, mêmes
 * bandes, mêmes seuils de largeur de contenu que OrderCard) pour éviter un
 * saut de mise en page quand les données arrivent.
 */
const ROWS = [1, 2, 3, 4];

export default function CommandesLoading() {
  return (
    <>
      <PageHeader title="Commandes" />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement des commandes…</p>
        {/* Silhouette de la recherche et des filtres : loading.tsx ne connaît pas l'URL. */}
        <OrdersFiltersSkeleton />
        <Skeleton className="h-4 w-28" />
        <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-none p-4 ring-1">
          <Skeleton className="h-4 w-56" />
          <div className="flex items-end justify-between gap-4">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-none ring-1 @xl/main:grid-cols-2 @4xl/main:grid-cols-[14rem_minmax(0,1fr)_20rem]"
            >
              <div className="bg-muted/40 flex flex-col gap-2 border-b p-4 @xl/main:col-span-2 @xl/main:p-5 @4xl/main:col-span-1 @4xl/main:border-r @4xl/main:border-b-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-28 rounded-4xl" />
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
