import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* État de chargement de /personnel : silhouette de la recherche et des cartes. */
const CARDS = [1, 2, 3, 4, 5, 6];
const FILTERS = [1, 2, 3, 4, 5];

export default function PersonnelLoading() {
  return (
    <>
      <PageHeader title="Personnel" />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement de l&apos;équipe…</p>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-11 w-full" />
            <div className="surface-tray grid gap-3 rounded-xl p-3">
              <Skeleton className="h-5 w-20" />
              <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-3 @5xl/main:grid-cols-5">
                {FILTERS.map((field) => (
                  <div
                    key={field}
                    className={
                      field === 1
                        ? "col-span-2 grid gap-1.5 @3xl/main:col-span-1"
                        : "grid gap-1.5"
                    }
                  >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-5 w-48" />
        <ul className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {CARDS.map((i) => (
            <li
              key={i}
              className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 ring-1 @2xl/main:p-5"
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
