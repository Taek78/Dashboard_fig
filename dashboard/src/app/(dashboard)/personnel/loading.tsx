import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/* État de chargement de /personnel : silhouette des onglets et des cartes. */
const CARDS = [1, 2, 3, 4, 5, 6];

export default function PersonnelLoading() {
  return (
    <>
      <PageHeader
        title="Personnel"
        description="L'équipe qui prépare et livre : coordonnées, horaires, disponibilité et historique de chacun."
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement de l&apos;équipe…</p>
        <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-4 w-40" />
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((i) => (
            <li
              key={i}
              className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 ring-1 md:p-5"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-52" />
                </div>
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
