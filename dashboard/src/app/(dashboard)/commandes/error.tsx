"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/*
 * Frontière d'erreur de /commandes : affichée si page.tsx lève (donc forcément
 * "use client", c'est un error boundary React). Elle protège page.tsx, pas le
 * layout : la coquille reste visible.
 * - Le détail va dans console.error (console du navigateur), jamais à l'écran :
 *   error.message peut contenir un hôte, un port, une requête.
 * - `retry` est la prop Next 16 pour relancer le rendu du segment.
 * - Une icône lucide est un SVG : le texte se place dans EmptyTitle /
 *   EmptyDescription, pas entre ses balises.
 */
export default function CommandesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RefreshCcw />
        </EmptyMedia>
        <EmptyTitle>Impossible de charger les commandes</EmptyTitle>
        <EmptyDescription>
          Une erreur est survenue de notre côté. Réessayez dans un instant ; si
          le problème persiste, contactez l&apos;administrateur.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={retry}>
          Réessayer
        </Button>
        {error.digest ? (
          <p className="text-muted-foreground text-xs">Code : {error.digest}</p>
        ) : null}
      </EmptyContent>
    </Empty>
  );
}
