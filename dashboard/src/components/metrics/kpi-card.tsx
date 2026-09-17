import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
 * Carte KPI (serveur) : une icône au dégradé de marque, le libellé sur toute
 * la largeur, la valeur avec son badge de tendance sur la même ligne (le
 * badge passe dessous si la place manque), un complément, et à droite un
 * petit visuel facultatif (RatioPie). Rien ne se chevauche, même à quatre
 * colonnes. La valeur est déjà formatée par l'appelant.
 * `tone="brand"` : carte au dégradé de marque pour le chiffre principal d'un écran.
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
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs leading-snug">
            {label}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-2xl font-semibold tracking-tight tabular-nums @2xl/main:text-[1.75rem]">
              {value}
            </span>
            {trend}
          </div>
          {hint ? (
            <span className="text-muted-foreground text-xs">{hint}</span>
          ) : null}
        </div>
        {visual ? (
          <div className="shrink-0 self-center pl-1">{visual}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
