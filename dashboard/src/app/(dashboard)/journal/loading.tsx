import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Squelette du journal. Il n'importe AUCUN module contenant un composant
 * client (règle de la CSP à nonce : Next écrirait son script dans le <head>
 * sans nonce, et la page serait bloquée au chargement complet).
 */
export default function JournalLoading() {
  return (
    <>
      <PageHeader title="Journal de sécurité" />
      <div aria-busy="true" className="flex flex-col gap-5">
        <p className="sr-only">Chargement du journal…</p>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-56" />
          </CardContent>
        </Card>
        <Skeleton className="h-5 w-72" />
        <ul className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
