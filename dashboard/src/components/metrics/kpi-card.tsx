import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/*
 * Carte KPI (serveur). La disposition suit la largeur de la CARTE (requête de
 * conteneur @container/kpi), pas celle de la page :
 * - carte étroite (tableau de bord sur téléphone, deux par ligne ; quatre par
 *   ligne sur ordinateur) : l'icône AU-DESSUS du libellé, la valeur garde
 *   toute la largeur ;
 * - carte large (métriques sur téléphone, une par ligne ; demande du
 *   2026-09-19) : l'icône À CÔTÉ du libellé, et le petit visuel (camembert)
 *   à DROITE du texte, centré : plus de grand vide sous le chiffre.
 * Rien ne se chevauche : le badge de tendance passe sous la valeur si la
 * place manque. La valeur est déjà formatée par l'appelant.
 * `tone="brand"` : carte au dégradé de marque pour le chiffre principal d'un
 * écran ; la tendance y garde un fond clair pour rester lisible.
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
        "card-highlight @container/kpi",
        brand
          ? "bg-gradient-brand text-white ring-0 [&_.text-muted-foreground]:text-white/80"
          : "glow-brand",
      )}
    >
      <CardContent className="relative flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2 @[17rem]/kpi:flex-row @[17rem]/kpi:gap-3">
          <div
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm @[17rem]/kpi:size-10 [&_svg]:size-4 @[17rem]/kpi:[&_svg]:size-5",
              brand ? "bg-white/20 ring-1 ring-white/30" : "bg-gradient-brand",
            )}
          >
            {icon}
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-muted-foreground text-xs leading-snug @[17rem]/kpi:text-sm">
              {label}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xl font-semibold tracking-tight tabular-nums @[17rem]/kpi:text-2xl @[22rem]/kpi:text-[1.75rem]">
                {value}
              </span>
              {trend ? (
                <span
                  className={cn(
                    "inline-flex rounded-full",
                    brand && "bg-background/90",
                  )}
                >
                  {trend}
                </span>
              ) : null}
            </div>
            {hint ? (
              <span className="text-muted-foreground text-xs leading-snug">
                {hint}
              </span>
            ) : null}
          </div>
        </div>
        {visual ? <div className="shrink-0">{visual}</div> : null}
      </CardContent>
    </Card>
  );
}
