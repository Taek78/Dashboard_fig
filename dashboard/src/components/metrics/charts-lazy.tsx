"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Graphiques chargés à la demande : recharts pèse lourd et n'est utile que sur
 * la page Métriques, après le premier rendu. `dynamic` avec ssr désactivé les
 * sort du JavaScript initial et du rendu serveur ; un squelette de la même
 * hauteur tient la place pendant le chargement (pas de saut de mise en page).
 */
export const ComparisonChart = dynamic(
  () =>
    import("@/components/metrics/comparison-chart").then(
      (m) => m.ComparisonChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full sm:h-80" /> },
);

export const StatusChart = dynamic(
  () => import("@/components/metrics/status-chart").then((m) => m.StatusChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);
