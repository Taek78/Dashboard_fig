import type { ReactNode } from "react";

/*
 * En-tête de page : le seul h1 de chaque page, avec description et actions optionnelles.
 *
 * - Un composant reçoit UN objet props (déstructuré ici), jamais des paramètres
 *   positionnels : <PageHeader title="…" /> passe { title: "…" }.
 * - Pas de <header> : site-header.tsx est déjà le repère <header> de la page ; un
 *   second embrouille les lecteurs d'écran. Ici un simple div.
 * - Le trait au dégradé de marque sous le titre est purement décoratif
 *   (aria-hidden) : il signe visuellement chaque page sans porter d'information.
 */
type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <span
          aria-hidden="true"
          className="bg-gradient-brand h-1 w-10 rounded-full"
        />
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
