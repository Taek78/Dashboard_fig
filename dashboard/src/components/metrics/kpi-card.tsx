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
 * `metric` (Métriques et tableau de bord, demandes du 2026-09-19), sur PC SEULEMENT (zone de
 * contenu ≥ @4xl, là où les cartes passent à plusieurs par ligne ; téléphone
 * et tablette inchangés) : l'icône et le titre ALIGNÉS sur une ligne, puis le
 * CHIFFRE en grand et en gras sur toute la largeur de la carte (grille ; le
 * bloc de texte passe en display: contents pour que titre et chiffre
 * rejoignent la grille), marges resserrées.
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
  metric = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  trend?: ReactNode;
  /** Petit visuel à droite (camembert plein). */
  visual?: ReactNode;
  tone?: "default" | "brand";
  /** Disposition « métrique » sur PC : icône et titre alignés, chiffre mis en avant. */
  metric?: boolean;
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
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col items-start gap-2 @[17rem]/kpi:flex-row @[17rem]/kpi:gap-3",
            metric &&
              "@4xl/main:grid @4xl/main:grid-cols-[auto_minmax(0,1fr)] @4xl/main:items-center @4xl/main:gap-x-2.5 @4xl/main:gap-y-2",
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm @[17rem]/kpi:size-10 [&_svg]:size-4 @[17rem]/kpi:[&_svg]:size-5",
              metric && "@4xl/main:size-9 @4xl/main:[&_svg]:size-[1.125rem]",
              brand ? "bg-white/20 ring-1 ring-white/30" : "bg-gradient-brand",
            )}
          >
            {icon}
          </div>
          <div
            className={cn(
              "flex w-full min-w-0 flex-1 flex-col gap-0.5",
              metric && "@4xl/main:contents",
            )}
          >
            <span
              className={cn(
                "text-muted-foreground text-xs leading-snug @[17rem]/kpi:text-sm",
                metric && "@4xl/main:text-sm @4xl/main:font-medium",
              )}
            >
              {label}
            </span>
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1",
                metric && "@4xl/main:col-span-2 @4xl/main:gap-x-2.5",
              )}
            >
              <span
                className={cn(
                  "text-xl font-semibold tracking-tight tabular-nums @[17rem]/kpi:text-2xl @[22rem]/kpi:text-[1.75rem]",
                  metric &&
                    "@4xl/main:text-[2.125rem] @4xl/main:leading-none @4xl/main:font-bold",
                )}
              >
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
              <span
                className={cn(
                  "text-muted-foreground text-xs leading-snug",
                  metric && "@4xl/main:col-span-2",
                )}
              >
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
