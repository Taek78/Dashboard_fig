import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Silhouette de la recherche des commandes, pour loading.tsx (qui ne connaît
 * pas l'URL) : la barre de recherche, puis le panneau des filtres (type de
 * commande, statut, préparateur, livreur) et sa zone de dates avec les
 * raccourcis des 7 derniers jours, mêmes colonnes que OrdersFilters.
 *
 * Module séparé de orders-filters.tsx EXPRÈS : un loading.tsx qui importe un
 * module contenant un composant client (AutoSubmitForm) fait écrire par Next,
 * dans le <head>, un <script src> de ce composant SANS nonce ; la CSP
 * ('strict-dynamic') le bloque et la console affiche une violation au
 * chargement complet de la page. Un loading.tsx n'importe que des composants
 * serveur (vérifié par e2e/csp.spec.ts).
 */
const SHORTCUTS = [1, 2, 3, 4, 5, 6, 7, 8];

export function OrdersFiltersSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-11 w-full" />
        <div className="surface-tray grid gap-3 rounded-xl p-3">
          <Skeleton className="h-5 w-20" />
          <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-3 @4xl/main:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="col-span-2 grid gap-1.5 @2xl/main:col-span-3 @4xl/main:col-span-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
            </div>
            <div className="col-span-2 grid gap-1.5 @2xl/main:col-span-1">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
          <div className="grid gap-2.5 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex flex-wrap gap-1.5">
                {SHORTCUTS.map((shortcut) => (
                  <Skeleton key={shortcut} className="h-6 w-24" />
                ))}
              </div>
            </div>
            <div className="grid gap-2 @xl/main:grid-cols-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
