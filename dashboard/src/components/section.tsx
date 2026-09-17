import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Section titrée d'une page (serveur) : un h2 signé d'un trait de marque, une
 * précision et des actions facultatives, puis son contenu. Le même en-tête
 * sert aux métriques, au tableau de bord et aux listes : d'une page à
 * l'autre, l'œil retrouve les mêmes repères.
 */
export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  /** Identifiant du h2 (aria-labelledby de la section). */
  id: string;
  title: string;
  description?: string;
  /** Liens ou boutons alignés à droite du titre. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b pb-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={id}
            className="flex items-center gap-2.5 text-xl font-semibold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="bg-gradient-brand h-5 w-1 shrink-0 rounded-full"
            />
            {title}
          </h2>
          {description ? (
            <p className="text-muted-foreground pl-3.5 text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
