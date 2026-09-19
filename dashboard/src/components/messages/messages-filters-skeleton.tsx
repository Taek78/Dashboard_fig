import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Silhouette de MessagesFilters, dans SON PROPRE module : la barre de
 * recherche, puis le panneau des filtres et sa zone de dates.
 *
 * Pourquoi séparée : un loading.tsx n'importe jamais un module contenant un
 * composant client. MessagesFilters utilise AutoSubmitForm ("use client") ;
 * si le loading.tsx importait ce module, Next écrirait le <script src> de ce
 * composant dans le <head> sans nonce et la CSP à 'strict-dynamic' le
 * bloquerait au chargement complet de la page (e2e/csp.spec.ts).
 */
export function MessagesFiltersSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-11 w-full" />
        <div className="surface-tray grid gap-3 rounded-none p-3">
          <Skeleton className="h-5 w-20" />
          <div className="grid grid-cols-2 gap-3 @2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="grid gap-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <Skeleton className="col-span-2 h-9 w-72 max-w-full self-end rounded-lg @2xl/main:col-span-1" />
          </div>
          <div className="grid gap-2.5 border-t pt-3">
            <Skeleton className="h-4 w-32" />
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
