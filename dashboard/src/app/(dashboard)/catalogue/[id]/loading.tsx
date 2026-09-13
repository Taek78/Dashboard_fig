import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProduitLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">Chargement du produit…</p>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-56" />
          <span
            aria-hidden="true"
            className="bg-gradient-brand h-1 w-10 rounded-full"
          />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <div className="bg-card ring-foreground/10 overflow-hidden rounded-2xl ring-1">
            <Skeleton className="h-36 rounded-none" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="grid gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
