import Image from "next/image";
import Link from "next/link";
import { Leaf, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CONTAINER_LABELS,
  LOCAL_COUNTRY,
  ORIGIN_COUNTRIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/domain/products/category";
import {
  formatCaliber,
  isLowStock,
  pricePerKgCents,
  unitPriceCents,
} from "@/domain/products/rules";
import type { Product } from "@/domain/products/types";
import { formatEuros, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte produit de la grille (serveur). Toute la carte est un lien vers la fiche.
 * Fond de l'illustration teinté par catégorie (orange = fruit, vert = légume),
 * badges Saison / Bio / drapeau France, état (masqué, indisponible, stock bas).
 * L'illustration est un emoji, ou l'image du client si imageUrl est renseignée.
 * Tous les signaux colorés ont un texte : la couleur n'est jamais seule.
 */
export function ProductCard({ product }: { product: Product }) {
  const perKg = pricePerKgCents(product);
  const perUnit = unitPriceCents(product);
  const caliber = formatCaliber(product.caliber);
  const isFruit = product.category === "fruit";
  const dimmed = !product.visible || !product.available;

  return (
    <Link
      href={`/catalogue/${product.id}`}
      className={cn(
        "group bg-card text-card-foreground ring-foreground/10 focus-visible:ring-ring card-lift flex flex-col overflow-hidden rounded-2xl shadow-sm ring-1 outline-none focus-visible:ring-2",
        dimmed && "opacity-75",
      )}
    >
      <div
        className={cn(
          "relative flex h-36 items-center justify-center",
          isFruit
            ? "bg-fruit text-fruit-foreground"
            : "bg-vegetable text-vegetable-foreground",
        )}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-6xl drop-shadow-sm transition-transform group-hover:scale-110"
          >
            {product.illustration}
          </span>
        )}

        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {product.inSeason ? (
            <Badge variant="success">
              <Sun aria-hidden="true" /> Saison
            </Badge>
          ) : null}
          {product.organic ? (
            <Badge variant="outline" className="bg-card/80">
              <Leaf aria-hidden="true" /> Bio
            </Badge>
          ) : null}
        </div>

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {product.originCountry === LOCAL_COUNTRY ? (
            <span
              role="img"
              aria-label="Produit français"
              title="Produit français"
              className="flag-fr ring-border/60 block size-5 rounded-full ring-1"
            />
          ) : null}
        </div>

        {!product.visible ? (
          <Badge variant="secondary" className="absolute bottom-2 left-2">
            Masqué
          </Badge>
        ) : !product.available ? (
          <Badge
            variant="outline"
            className="bg-card/80 absolute bottom-2 left-2"
          >
            Indisponible
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate leading-tight font-semibold">
              {product.name}
            </h3>
            <p className="text-muted-foreground truncate text-xs">
              {product.variety ?? "—"} ·{" "}
              {PRODUCT_CATEGORY_LABELS[product.category]}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              isFruit
                ? "bg-fruit text-fruit-foreground"
                : "bg-vegetable text-vegetable-foreground",
            )}
          >
            {PRODUCT_CATEGORY_LABELS[product.category]}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Prix unitaire</dt>
          <dd className="text-right font-medium tabular-nums">
            {perUnit === null ? "—" : `${formatEuros(perUnit)} / pièce`}
          </dd>
          <dt className="text-muted-foreground">Prix au kilo</dt>
          <dd className="text-right font-medium tabular-nums">
            {perKg === null ? "—" : `${formatEuros(perKg)} / kg`}
          </dd>
          <dt className="text-muted-foreground">Contenant</dt>
          <dd className="text-right">{CONTAINER_LABELS[product.container]}</dd>
          <dt className="text-muted-foreground">Origine</dt>
          <dd className="truncate text-right">
            {ORIGIN_COUNTRIES[product.originCountry]}
            {product.originRegion ? `, ${product.originRegion}` : ""}
          </dd>
          <dt className="text-muted-foreground">Calibre</dt>
          <dd className="text-right tabular-nums">{caliber ?? "—"}</dd>
        </dl>

        <div className="mt-auto flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-muted-foreground">
            Stock : {formatQuantity(product.stockQuantity, product.unit)}
          </span>
          {isLowStock(product) ? (
            <Badge variant="warning">Stock bas</Badge>
          ) : product.available && product.visible ? (
            <Badge variant="success">En vente</Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
