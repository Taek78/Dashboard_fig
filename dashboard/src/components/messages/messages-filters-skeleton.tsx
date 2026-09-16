import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Silhouette de MessagesFilters, dans SON PROPRE module.
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
        <div className="grid grid-cols-2 gap-3 border-t pt-4 @4xl/main:grid-cols-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-4 w-72" />
      </CardContent>
    </Card>
  );
}
