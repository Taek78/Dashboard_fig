import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
 * Carte KPI (serveur) : une icône au dégradé de marque, le libellé sur toute
 * la largeur, la valeur avec son badge de tendance sur la même ligne (le
 * badge passe dessous si la place manque), un complément, et à droite un
 * petit visuel facultatif (RatioPie). Rien ne se chevauche, même à quatre
 * colonnes. La valeur est déjà formatée par l'appelant. Sur une zone étroite
 * (téléphone, deux cartes par ligne), l'icône passe AU-DESSUS du libellé et
 * rétrécit : la valeur garde toute la largeur de la carte.
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
      <CardContent className="relative flex flex-col items-start gap-2 @xl/main:flex-row @xl/main:gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm @xl/main:size-10 [&_svg]:size-4 @xl/main:[&_svg]:size-5",
            brand ? "bg-white/20 ring-1 ring-white/30" : "bg-gradient-brand",
          )}
        >
          {icon}
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs leading-snug">
            {label}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xl font-semibold tracking-tight tabular-nums @xl/main:text-2xl @2xl/main:text-[1.75rem]">
              {value}
            </span>
            {trend}
          </div>
          {hint ? (
            <span className="text-muted-foreground text-xs">{hint}</span>
          ) : null}
        </div>
        {visual ? (
          <div className="shrink-0 self-end @xl/main:self-center @xl/main:pl-1">
            {visual}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
