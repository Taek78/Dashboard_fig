import type { ReactNode } from "react";

/*
 * Section de la page Métriques (serveur) : un titre h2, une courte précision
 * facultative, puis ses cartes. Trier les métriques par thème
 * (ventes, commandes, produits, usage) rend la page lisible d'un coup d'œil.
 */
export function MetricsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 border-b pb-2">
        <h2 id={id} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
