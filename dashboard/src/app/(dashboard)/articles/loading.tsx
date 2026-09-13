import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* Chargement de /articles : carte de rédaction puis cartes horizontales. */
const ROWS = [1, 2, 3];

export default function ArticlesLoading() {
  return (
    <>
      <PageHeader
        title="Articles"
        description="Conseils d'alimentation, recettes, articles scientifiques et actualité agroalimentaire publiés dans l'application."
      />
      <div aria-busy="true" className="flex flex-col gap-5">
        <p className="sr-only">Chargement des articles…</p>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Skeleton className="h-5 w-56" />
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-2xl ring-1 sm:flex-row"
            >
              <Skeleton className="h-36 rounded-none sm:h-auto sm:w-44" />
              <div className="flex flex-1 flex-col gap-2 p-4 md:p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
