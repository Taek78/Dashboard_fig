import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">Chargement du client…</p>
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
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
      <div className="grid gap-4 @4xl/main:grid-cols-3">
        {["coordonnees", "chiffres"].map((card) => (
          <Card key={card}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
        <Card className="@4xl/main:row-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-36" />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2 @4xl/main:col-span-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-48 w-full rounded-none" />
        </div>
      </div>
    </div>
  );
}
