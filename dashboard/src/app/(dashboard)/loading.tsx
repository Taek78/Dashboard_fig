import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* Chargement du tableau de bord (route « / » uniquement : les sections ont leur propre loading.tsx). */
export default function TableauDeBordLoading() {
  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Chargement de la période…"
      />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement du tableau de bord…</p>
        <Card>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
            <Skeleton className="h-8 w-full md:w-60" />
            <Skeleton className="h-8 w-full md:w-40" />
            <Skeleton className="h-8 w-full md:w-40" />
            <Skeleton className="h-8 w-full md:w-28" />
          </CardContent>
          <CardContent className="border-t pt-4">
            <Skeleton className="h-8 w-56" />
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} size="sm">
              <CardContent className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-8 w-full sm:w-44" />
          <Skeleton className="h-8 w-full sm:w-36" />
          <Skeleton className="h-8 w-full sm:w-28" />
        </div>
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </>
  );
}
