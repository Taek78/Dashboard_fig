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
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {["etat", "modifier"].map((card) => (
          <Card key={card}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
