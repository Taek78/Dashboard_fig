import { useId } from "react";
import { cn } from "@/lib/utils";

/*
 * Camembert (anneau) d'un ratio, en SVG pur : aucun JavaScript côté client,
 * aucune bibliothèque. L'arc rempli est proportionnel au pourcentage ; le
 * pourcentage est aussi écrit au centre, et l'ensemble porte un libellé pour
 * les lecteurs d'écran. Couleurs par tokens : marque (défaut), succès, alerte.
 */
const SIZE = 60;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONES = {
  brand: { from: "var(--brand-from)", to: "var(--brand-to)" },
  success: { from: "var(--success)", to: "var(--success)" },
  destructive: { from: "var(--destructive)", to: "var(--destructive)" },
} as const;

export function RatioDonut({
  percent,
  label,
  tone = "brand",
  className,
}: {
  /** 0 à 100 ; null quand le ratio n'est pas calculable (total nul). */
  percent: number | null;
  /** Ce que représente la part pleine, pour les lecteurs d'écran. */
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const id = useId();
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const filled = (value / 100) * CIRCUMFERENCE;
  const colors = TONES[tone];

  return (
    <svg
      role="img"
      aria-label={`${percent === null ? "Ratio indisponible" : `${percent} %`} : ${label}`}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
      </defs>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={STROKE}
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground text-[11px] font-semibold tabular-nums"
      >
        {percent === null ? "—" : `${percent}%`}
      </text>
    </svg>
  );
}
