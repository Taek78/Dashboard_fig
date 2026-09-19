import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">Chargement de l&apos;article…</p>
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-72 max-w-full" />
          <span
            aria-hidden="true"
            className="bg-gradient-brand h-1 w-10 rounded-full"
          />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-44" />
        <div className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-none ring-1 @xl/main:flex-row">
          <Skeleton className="h-36 rounded-none @xl/main:h-auto @xl/main:w-44" />
          <div className="flex flex-1 flex-col gap-2 p-4 @2xl/main:p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-8 w-52" />
        </CardContent>
      </Card>
    </div>
  );
}
