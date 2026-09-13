"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { breadcrumbFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/*
 * Fil d'Ariane du bandeau (client : usePathname). Les maillons viennent de la
 * fonction pure breadcrumbFor ; ce composant ne fait que les rendre.
 * Le dernier maillon porte aria-current="page" et n'est pas un lien.
 */
export function SiteBreadcrumb({ className }: { className?: string }) {
  const crumbs = breadcrumbFor(usePathname());
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Fil d'Ariane" className={cn("min-w-0 text-sm", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb) => (
          <li key={crumb.title} className="flex min-w-0 items-center gap-1.5">
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground truncate transition-colors"
              >
                {crumb.title}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium">
                {crumb.title}
              </span>
            )}
            {crumb.href ? (
              <ChevronRight
                aria-hidden="true"
                className="text-muted-foreground/60 size-3.5 shrink-0"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
