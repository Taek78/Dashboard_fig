import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Chargement d'une fiche message : la silhouette de la carte client puis celle
 * du message. Composant serveur, sans aucun import de composant client (CSP).
 */
export default function MessageLoading() {
  return (
    <>
      <PageHeader
        title="Message client"
        description="Fiche du client, puis sa demande complète."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement du message…</p>
        <div className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 ring-1 @2xl/main:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-32 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-2xl p-4 ring-1 @2xl/main:p-5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </>
  );
}
