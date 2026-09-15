import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
 * Carte KPI (serveur) : un libellé, une valeur, un complément optionnel, une
 * icône au dégradé de marque et, en haut à droite, un badge de tendance
 * optionnel (TrendBadge). La valeur est déjà formatée par l'appelant.
 * `tone="brand"` : carte au dégradé de marque pour le chiffre principal d'un écran.
 * `visual` : un petit graphique (RatioPie) calé à droite du chiffre.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  trend,
  visual,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  trend?: ReactNode;
  /** Petit visuel à droite (camembert plein). */
  visual?: ReactNode;
  tone?: "default" | "brand";
}) {
  const brand = tone === "brand";
  return (
    <Card
      size="sm"
      className={cn(
        "card-lift",
        brand
          ? "bg-gradient-brand text-white ring-0 [&_.text-muted-foreground]:text-white/80"
          : "glow-brand",
      )}
    >
      <CardContent className="relative flex items-start gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [&_svg]:size-5",
            brand ? "bg-white/20 ring-1 ring-white/30" : "bg-gradient-brand",
          )}
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            {trend}
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums @2xl/main:text-[1.75rem]">
            {value}
          </span>
          {hint ? (
            <span className="text-muted-foreground text-xs">{hint}</span>
          ) : null}
        </div>
        {visual ? <div className="shrink-0 self-center">{visual}</div> : null}
      </CardContent>
    </Card>
  );
}
