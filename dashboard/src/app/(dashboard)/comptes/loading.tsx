import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ComptesLoading() {
  return (
    <>
      <PageHeader
        title="Comptes"
        description="Qui peut se connecter au back-office, avec quel rôle."
      />
      <div aria-busy="true" className="flex flex-col gap-5">
        <p className="sr-only">Chargement des comptes…</p>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
        <Skeleton className="h-5 w-48" />
        <ul className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 ring-1 md:p-5"
            >
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-7 w-48" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
