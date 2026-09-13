import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/*
 * Carte KPI (serveur) : un libellé, une valeur, un complément optionnel et une
 * icône au dégradé de marque. La valeur est déjà formatée par l'appelant.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="bg-gradient-brand flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [&_svg]:size-5"
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-muted-foreground text-xs">{label}</span>
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
