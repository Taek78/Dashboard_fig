import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Page } from "@/domain/orders/rules";
import { cn } from "@/lib/utils";

/*
 * Navigation entre les pages d'une liste (serveur) : précédent, indicateur,
 * suivant. Les liens conservent les filtres courants (`baseParams`) et ne
 * changent que ?page=. Un bouton désactivé reste un <span> : rien à cliquer.
 */
export function OrdersPagination({
  page,
  baseParams,
  path = "/commandes",
  hash,
}: {
  page: Page<unknown>;
  /** Paramètres d'URL à conserver, sans « page » (ex. "statut=preparing"). */
  baseParams: string;
  /** Liste paginée (les commandes par défaut, les clients, une fiche). */
  path?: string;
  /** Ancre de la liste dans la page (une fiche : la liste est sous le formulaire). */
  hash?: string;
}) {
  if (page.pageCount <= 1) return null;
  const href = (n: number) =>
    `${path}?${baseParams ? `${baseParams}&` : ""}page=${n}${hash ? `#${hash}` : ""}`;
  const disabled = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "pointer-events-none opacity-50",
  );

  return (
    <nav
      aria-label="Pages de la liste"
      className="flex items-center justify-between gap-3"
    >
      {page.page > 1 ? (
        <Link
          href={href(page.page - 1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft aria-hidden="true" />
          Précédente
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          <ChevronLeft aria-hidden="true" />
          Précédente
        </span>
      )}
      <p className="text-muted-foreground text-sm tabular-nums">
        Page {page.page} sur {page.pageCount}
      </p>
      {page.page < page.pageCount ? (
        <Link
          href={href(page.page + 1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Suivante
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          Suivante
          <ChevronRight aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
