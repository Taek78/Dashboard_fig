import type { ReactNode } from "react";

/*
 * En-tête de page : le seul h1 de chaque page, avec description et actions optionnelles.
 *
 * - Un composant reçoit UN objet props (déstructuré ici), jamais des paramètres
 *   positionnels : <PageHeader title="…" /> passe { title: "…" }.
 * - Pas de <header> : site-header.tsx est déjà le repère <header> de la page ; un
 *   second embrouille les lecteurs d'écran. Ici un simple div.
 * - Export nommé, comme tous les composants de src/components/ui.
 */
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
