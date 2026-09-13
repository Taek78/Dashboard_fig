import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * État de chargement de /commandes. Next l'affiche automatiquement pendant que
 * page.tsx attend getOrders() (frontière Suspense). Composant serveur.
 * On reproduit la silhouette des cartes (même cadre, mêmes bandes) pour éviter
 * un saut de mise en page quand les données arrivent.
 */
const ROWS = [1, 2, 3, 4];

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
          <Skeleton className="h-8 w-full md:w-20" />
        </div>
        <Skeleton className="h-4 w-28" />
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-2xl ring-1 md:flex-row"
            >
              <div className="bg-muted/40 flex flex-col gap-2 border-b p-4 md:w-52 md:border-r md:border-b-0 md:p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-24 rounded-4xl" />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-44" />
              </div>
              <div className="flex flex-col justify-center gap-2 border-t p-4 md:w-72 md:border-t-0 md:border-l md:p-5">
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
