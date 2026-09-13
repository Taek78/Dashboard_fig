import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/*
 * Carte KPI (serveur) : un libellé, une valeur, un complément optionnel, une
 * icône au dégradé de marque et, en haut à droite, un badge de tendance
 * optionnel (TrendBadge). La valeur est déjà formatée par l'appelant.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="bg-gradient-brand flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [&_svg]:size-5"
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            {trend}
          </div>
          <span className="text-xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {hint ? (
            <span className="text-muted-foreground text-xs">{hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
