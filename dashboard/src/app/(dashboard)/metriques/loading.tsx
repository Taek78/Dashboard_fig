import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MetriquesLoading() {
  return (
    <>
      <PageHeader title="Métriques" description="Chargement de la période…" />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement des métriques…</p>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-end">
              <Skeleton className="h-9 w-full rounded-lg @2xl/main:w-56" />
              <Skeleton className="h-9 w-full rounded-lg @2xl/main:w-52" />
              <Skeleton className="h-9 w-full rounded-lg @2xl/main:ml-auto @2xl/main:w-64" />
            </div>
            <div className="surface-tray grid gap-2.5 rounded-xl p-3">
              <Skeleton className="h-4 w-24" />
              <div className="grid gap-2 @xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg @xl/main:w-28" />
              </div>
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} size="sm">
              <CardContent className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
        <div className="grid gap-4 @4xl/main:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
