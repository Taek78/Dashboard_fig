import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { computeTrend } from "@/domain/metrics/rules";
import { cn } from "@/lib/utils";

/*
 * Badge de tendance (serveur) : flèche et pourcentage de variation entre la
 * valeur courante et la valeur de référence (computeTrend).
 * - haut / bas : vert si favorable, rouge sinon ; `lowerIsBetter` inverse la
 *   lecture (annulations, réclamations) ;
 * - plat (rien vendu des deux côtés, ou variation dans la bande ±0,4 %) : bleu,
 *   flèche horizontale, « 0 % » ;
 * - référence nulle avec une valeur : +100 % (on part de zéro).
 * Le sens est toujours porté par le texte (signe, sr-only), jamais par la
 * couleur seule.
 */
export function TrendBadge({
  current,
  previous,
  lowerIsBetter = false,
  referenceLabel,
}: {
  current: number | null;
  previous: number | null;
  lowerIsBetter?: boolean;
  referenceLabel: string;
}) {
  const trend = computeTrend(current, previous);
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums";

  if (trend.direction === "flat") {
    return (
      <span
        className={cn(base, "bg-info/15 text-info")}
        title={`Stable vs ${referenceLabel.toLowerCase()}`}
      >
        <ArrowRight className="size-3" aria-hidden="true" />0 %
        <span className="sr-only">
          {" "}
          stable vs {referenceLabel.toLowerCase()}
        </span>
      </span>
    );
  }

  const up = trend.direction === "up";
  const good = lowerIsBetter ? !up : up;

  return (
    <span
      className={cn(
        base,
        good
          ? "bg-success/15 text-success"
          : "bg-destructive/12 text-destructive",
      )}
      title={`Variation vs ${referenceLabel.toLowerCase()}`}
    >
      {up ? (
        <ArrowUp className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-3" aria-hidden="true" />
      )}
      {up ? "+" : ""}
      {trend.percent} %
      <span className="sr-only">
        {" "}
        vs {referenceLabel.toLowerCase()}, {good ? "favorable" : "défavorable"}
      </span>
    </span>
  );
}
