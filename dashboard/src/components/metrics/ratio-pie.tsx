"use client";

import { useState } from "react";
import { pieSlicePaths } from "@/lib/pie";
import { cn } from "@/lib/utils";

/*
 * Camembert plein (client : survol). Chaque part est proportionnelle à sa
 * valeur et porte sa couleur de token ; aucun pourcentage n'est écrit. Au
 * survol d'une part, une étiquette dit à quoi elle correspond (libellé et
 * nombre) et les autres parts s'estompent. Pour un lecteur d'écran, le
 * camembert est une image dont le nom énumère les parts : aucune information
 * n'est réservée à la souris. SVG pur, géométrie calculée par pieSlicePaths.
 * Sans aucune valeur, un simple anneau en pointillé : pas de disque gris qui
 * ressemblerait à une donnée.
 */
export const PIE_TONES = {
  brand: "var(--primary)",
  success: "var(--success)",
  destructive: "var(--destructive)",
  community: "var(--community)",
  individual: "var(--individual)",
  rest: "color-mix(in oklch, var(--muted-foreground) 30%, transparent)",
} as const;
export type PieTone = keyof typeof PIE_TONES;
export type PieSlice = { label: string; value: number; tone: PieTone };

export function RatioPie({
  slices,
  label,
  size = 56,
  className,
}: {
  slices: PieSlice[];
  /** Ce que représente le camembert (nom accessible, avant le détail des parts). */
  label: string;
  /** Diamètre en pixels. */
  size?: number;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const radius = size / 2;
  const paths = pieSlicePaths(
    slices.map((s) => s.value),
    radius,
  );
  const current = active === null ? null : slices[active];
  const description = `${label} : ${slices
    .map((s) => `${s.label} ${s.value.toLocaleString("fr-FR")}`)
    .join(", ")}`;

  return (
    <div
      className={cn("relative shrink-0", className)}
      onMouseLeave={() => setActive(null)}
    >
      <svg
        role="img"
        aria-label={description}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {paths.length === 0 ? (
          <circle
            cx={radius}
            cy={radius}
            r={radius - 1.5}
            fill="none"
            stroke={PIE_TONES.rest}
            strokeWidth={2}
            strokeDasharray="3 4"
          />
        ) : (
          paths.map((slice) => (
            <path
              key={slice.index}
              d={slice.path}
              fill={PIE_TONES[slices[slice.index]!.tone]}
              stroke="var(--card)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              className={cn(
                "cursor-default transition-opacity duration-150",
                active !== null && active !== slice.index && "opacity-40",
              )}
              onMouseEnter={() => setActive(slice.index)}
            />
          ))
        )}
      </svg>
      {current ? (
        <div
          role="tooltip"
          className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 right-full z-10 mr-2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs whitespace-nowrap shadow-md"
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: PIE_TONES[current.tone] }}
          />
          <span>{current.label}</span>
          <span className="font-semibold tabular-nums">
            {current.value.toLocaleString("fr-FR")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
