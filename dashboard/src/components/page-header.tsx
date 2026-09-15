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
    <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-start @2xl/main:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance @2xl/main:text-4xl">
          {title}
        </h1>
        <span
          aria-hidden="true"
          className="bg-gradient-brand h-1.5 w-12 rounded-full"
        />
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty @2xl/main:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 @2xl/main:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
