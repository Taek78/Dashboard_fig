import Image from "next/image";
import Link from "next/link";
import { Leaf, Pencil, Sun } from "lucide-react";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { DuplicateProductButton } from "@/components/products/duplicate-product-button";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import {
  productSaleStatus,
  type CatalogSettings,
} from "@/domain/products/status";
import type { Product } from "@/domain/products/types";
import { formatEuros, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte produit de la grille (serveur). L'illustration et le nom mènent à la
 * fiche ; la barre d'actions en pied (modifier, dupliquer, supprimer) agit
 * directement depuis la grille pour un rôle qui peut modifier le catalogue.
 * La carte est un <article> et non un lien : un lien ne peut pas contenir de
 * boutons. Fond de l'illustration teinté par catégorie (orange = fruit,
 * vert = légume), badges Saison / Bio / drapeau France, et le STATUT DE VENTE
 * posé sur l'image (en vente, rupture de stock, indisponible, masqué : règle
 * productSaleStatus, selon le paramètre du catalogue) ; en pied, le stock et
 * l'alerte de stock bas seulement. L'illustration est un emoji, ou l'image du
 * client si imageUrl est renseignée. Tous les signaux colorés ont un texte.
 */
export function ProductCard({
  product,
  settings,
  canEdit = false,
}: {
  product: Product;
  /** Paramètre du catalogue : décide si un stock à 0 est une rupture. */
  settings: CatalogSettings;
  /** Affiche la barre d'actions (grille). L'aperçu de la fiche la masque. */
  canEdit?: boolean;
}) {
  const perKg = pricePerKgCents(product);
  const perUnit = unitPriceCents(product);
  const caliber = formatCaliber(product.caliber);
  const isFruit = product.category === "fruit";
  const status = productSaleStatus(product, settings);
  const dimmed = status !== "en_vente";
  const href = `/catalogue/${product.id}`;

  return (
    <article
      aria-label={`Produit ${product.name}`}
      className={cn(
        "group bg-card text-card-foreground ring-foreground/10 card-lift flex h-full flex-col overflow-hidden rounded-2xl shadow-sm ring-1",
        dimmed && "opacity-75",
      )}
    >
      <Link
        href={href}
        aria-label={`${product.name} : ouvrir la fiche`}
        className={cn(
          "focus-visible:ring-ring relative flex h-36 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset",
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

        <span className="absolute top-2 left-2 flex flex-wrap gap-1">
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
        </span>

        {product.originCountry === LOCAL_COUNTRY ? (
          <span
            role="img"
            aria-label="Produit français"
            title="Produit français"
            className="flag-fr ring-border/60 absolute top-2 right-2 block size-5 rounded-full ring-1"
          />
        ) : null}

        <ProductStatusBadge
          status={status}
          className="absolute bottom-2 left-2"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate leading-tight font-semibold">
              <Link
                href={href}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {product.name}
              </Link>
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
          {product.stockQuantity > 0 && isLowStock(product) ? (
            <Badge variant="warning">Stock bas</Badge>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div
          role="group"
          aria-label={`Actions sur ${product.name}`}
          className="bg-muted/40 flex flex-wrap items-center gap-1 border-t px-2 py-1.5"
        >
          <Link
            href={href}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Pencil />
            Modifier
          </Link>
          <DuplicateProductButton
            productId={product.id}
            size="icon-sm"
            iconOnly
          />
          <span className="flex-1" />
          <DeleteProductButton
            productId={product.id}
            productName={product.name}
            compact
          />
        </div>
      ) : null}
    </article>
  );
}
