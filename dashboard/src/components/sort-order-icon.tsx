import { cn } from "@/lib/utils";

/*
 * Icône du sens d'un tri (serveur ou client, sans état) : deux repères fixes à
 * gauche, « A / Z » pour des lettres, « 1 / 9 » pour des nombres, et une
 * flèche à droite, vers le bas pour l'ordre croissant (A → Z, 1 → 9), vers le
 * haut pour l'ordre décroissant. Seule la flèche pivote, en une rotation
 * rapide (200 ms) ; aucune animation si l'appareil demande moins de mouvement.
 * Les icônes de Lucide écrivent « 0 / 1 » : celle-ci est dessinée ici.
 */
export function SortOrderIcon({
  scale,
  order,
  className,
}: {
  scale: "alpha" | "numeric";
  order: "croissant" | "decroissant";
  className?: string;
}) {
  const [top, bottom] = scale === "alpha" ? ["A", "Z"] : ["1", "9"];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-order={order}
      className={cn("size-6", className)}
    >
      <g
        fill="currentColor"
        fontSize="11.5"
        fontWeight="700"
        textAnchor="middle"
      >
        <text x="6.5" y="10.5">
          {top}
        </text>
        <text x="6.5" y="23">
          {bottom}
        </text>
      </g>
      <g
        data-slot="sort-arrow"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "origin-center transition-transform duration-200 ease-out [transform-box:fill-box] motion-reduce:transition-none",
          order === "decroissant" && "rotate-180",
        )}
      >
        <path d="M18.5 2.5v19" />
        <path d="m14.5 17.5 4 4 4-4" />
      </g>
    </svg>
  );
}
