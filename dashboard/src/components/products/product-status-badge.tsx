import {
  PRODUCT_SALE_STATUS_LABELS,
  type ProductSaleStatus,
} from "@/domain/products/status";
import { cn } from "@/lib/utils";

/*
 * Statut de vente d'un produit (serveur), posé SUR l'image de sa carte : une
 * pastille opaque et contrastée, lisible sur n'importe quel visuel, avec un
 * point de couleur et le texte (la couleur n'est jamais le seul signal).
 */
const TONES: Record<ProductSaleStatus, { dot: string; text: string }> = {
  en_vente: { dot: "bg-success", text: "text-success" },
  rupture: { dot: "bg-destructive", text: "text-destructive" },
  indisponible: { dot: "bg-warning", text: "text-warning" },
  masque: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

export function ProductStatusBadge({
  status,
  className,
}: {
  status: ProductSaleStatus;
  className?: string;
}) {
  const tone = TONES[status];
  return (
    <span
      data-status={status}
      className={cn(
        "bg-card/95 ring-foreground/10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 backdrop-blur-sm",
        tone.text,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", tone.dot)}
      />
      <span className="sr-only">Statut : </span>
      {PRODUCT_SALE_STATUS_LABELS[status]}
    </span>
  );
}
