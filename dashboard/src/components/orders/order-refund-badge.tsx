import { HandCoins, TicketPercent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REFUND_KIND_LABELS, type RefundKind } from "@/domain/orders/refund";
import type { Order } from "@/domain/orders/types";
import { formatEuros } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Badge d'une commande annulée REMBOURSÉE ou en AVOIR (serveur, demande du
 * 2026-09-19) : badge plein bien visible, « Remboursement » en cuivre
 * (--refund), « Avoir » en sarcelle (--credit), avec le montant. Rien si la
 * commande n'en a pas. La carte prend la même couleur (REFUND_ACCENT).
 */
const TONE: Record<RefundKind, string> = {
  refund: "bg-refund text-background",
  credit: "bg-credit text-background",
};

const ICONS = { refund: HandCoins, credit: TicketPercent } as const;

/** Bordure gauche d'une carte remboursée ou en avoir, à la place de celle du statut. */
export const REFUND_ACCENT: Record<RefundKind, string> = {
  refund: "border-l-refund",
  credit: "border-l-credit",
};

/** Teinte de la bande du créneau d'une carte remboursée ou en avoir. */
export const REFUND_BAND: Record<RefundKind, string> = {
  refund: "bg-refund/12",
  credit: "bg-credit/12",
};

export function OrderRefundBadge({
  order,
  withAmount = true,
  className,
}: {
  order: Pick<Order, "refund">;
  /** Montant à côté du libellé (cartes, fiche) ; sans dans un tableau serré. */
  withAmount?: boolean;
  className?: string;
}) {
  if (!order.refund) return null;
  const { kind, amountCents } = order.refund;
  const Icon = ICONS[kind];
  return (
    <Badge
      data-refund={kind}
      className={cn(
        "h-auto max-w-full border-transparent font-semibold whitespace-normal",
        TONE[kind],
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {REFUND_KIND_LABELS[kind]}
      {withAmount ? (
        <span className="tabular-nums"> {formatEuros(amountCents)}</span>
      ) : null}
    </Badge>
  );
}
