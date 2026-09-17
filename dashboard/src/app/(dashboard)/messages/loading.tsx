import { MessagesFiltersSkeleton } from "@/components/messages/messages-filters-skeleton";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * État de chargement de /messages, affiché par Next pendant que page.tsx attend
 * la base. Composant serveur, et qui n'importe AUCUN module contenant un
 * composant client (d'où messages-filters-skeleton.tsx à part) : la CSP à
 * 'strict-dynamic' bloquerait le script écrit sans nonce dans le <head>.
 * Même silhouette que MessageCard pour éviter un saut de mise en page.
 */
const ROWS = [1, 2, 3, 4];

export default function MessagesLoading() {
  return (
    <>
      <PageHeader title="Messages" />
      <div aria-busy="true" className="flex flex-col gap-4">
        <p className="sr-only">Chargement des messages…</p>
        <MessagesFiltersSkeleton />
        <Skeleton className="h-4 w-56" />
        <ul className="flex flex-col gap-4">
          {ROWS.map((row) => (
            <li
              key={row}
              className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-2xl p-4 ring-1 @2xl/main:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-6 w-44 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-28 rounded-4xl" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 border-t pt-3">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-7 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
