import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Silhouette de la barre de recherche des commandes et livraisons, pour les
 * loading.tsx (qui ne connaissent pas l'URL).
 *
 * Module séparé de orders-filters.tsx EXPRÈS : un loading.tsx qui importe un
 * module contenant un composant client (AutoSubmitForm) fait écrire par Next,
 * dans le <head>, un <script src> de ce composant SANS nonce ; la CSP
 * ('strict-dynamic') le bloque et la console affiche une violation au
 * chargement complet de la page. Un loading.tsx n'importe que des composants
 * serveur (vérifié par e2e/csp.spec.ts).
 */
const FIELD_SKELETONS = [1, 2, 3, 4, 5];

export function OrdersFiltersSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-96 max-w-full @max-2xl/main:hidden" />
        <div className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-5">
          {FIELD_SKELETONS.map((field) => (
            <div
              key={field}
              className={
                field === 1
                  ? "col-span-2 grid gap-1.5 @4xl/main:col-span-1"
                  : "grid gap-1.5"
              }
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
