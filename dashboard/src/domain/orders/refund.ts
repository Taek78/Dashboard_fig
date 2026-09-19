/*
 * Remboursement ou avoir d'une commande ANNULÉE (demande du 2026-09-19) :
 * l'équipe (admin, gestionnaire) l'enregistre sur la fiche de la commande,
 * total ou partiel, jamais au-dessus du total payé. Deux types distincts :
 * - « Remboursement » : l'argent est rendu au client ;
 * - « Avoir » : un crédit à valoir sur une prochaine commande.
 * Une commande remboursée RESTE annulée (la base le tient : contrainte
 * orders_refund_cancelled) ; retirer le remboursement la libère.
 * Clés anglaises (enum Postgres refund_kind), libellés français.
 */
export const REFUND_KINDS = ["refund", "credit"] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];

export const REFUND_KIND_LABELS: Record<RefundKind, string> = {
  refund: "Remboursement",
  credit: "Avoir",
};

export type OrderRefund = {
  kind: RefundKind;
  /** Montant rendu ou crédité, en centimes : 0 < montant ≤ total de la commande. */
  amountCents: number;
  /** ISO 8601 : quand l'équipe l'a enregistré. */
  at: string;
};

/** Un remboursement ne s'enregistre que sur une commande annulée qui a coûté quelque chose. */
export function acceptsRefund(order: {
  status: string;
  totalCents: number;
}): boolean {
  return order.status === "cancelled" && order.totalCents > 0;
}

/** Montant entier, strictement positif, au plus le total payé. */
export function isRefundAmountValid(
  amountCents: number,
  totalCents: number,
): boolean {
  return (
    Number.isInteger(amountCents) &&
    amountCents > 0 &&
    amountCents <= totalCents
  );
}

/** « Remboursement total » ; « Avoir partiel ». */
export function refundScopeLabel(
  refund: Pick<OrderRefund, "kind" | "amountCents">,
  totalCents: number,
): string {
  const scope = refund.amountCents >= totalCents ? "total" : "partiel";
  return `${REFUND_KIND_LABELS[refund.kind]} ${scope}`;
}

/* ---------- Métrique ---------- */

/** Un type sur la période : nombre de commandes, montant, part des commandes. */
export type RefundKindShare = {
  count: number;
  amountCents: number;
  /** Part des commandes de la période, en % à une décimale ; null sans commande. */
  percent: number | null;
};

export type RefundShare = Record<RefundKind, RefundKindShare>;

/** Totaux bruts (lus par la base ou comptés en mémoire). */
export type RefundTotals = Record<
  RefundKind,
  { count: number; amountCents: number }
>;

export const NO_REFUNDS: RefundTotals = {
  refund: { count: 0, amountCents: 0 },
  credit: { count: 0, amountCents: 0 },
};

/** 3 sur 40 → 7,5 ; une décimale : les remboursements sont rares. */
export function sharePercent(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 1000) / 10;
}

/** Parts des remboursements et des avoirs parmi TOUTES les commandes de la période. */
export function refundShareFrom(
  totals: RefundTotals,
  orderCount: number,
): RefundShare {
  const share = (kind: RefundKind): RefundKindShare => ({
    ...totals[kind],
    percent: sharePercent(totals[kind].count, orderCount),
  });
  return { refund: share("refund"), credit: share("credit") };
}

/** Totaux d'une liste de commandes déjà bornée à la période (règle de parité du SQL). */
export function refundTotals(
  orders: readonly {
    refund: Pick<OrderRefund, "kind" | "amountCents"> | null;
  }[],
): RefundTotals {
  const totals: RefundTotals = {
    refund: { count: 0, amountCents: 0 },
    credit: { count: 0, amountCents: 0 },
  };
  for (const order of orders) {
    if (!order.refund) continue;
    totals[order.refund.kind].count += 1;
    totals[order.refund.kind].amountCents += order.refund.amountCents;
  }
  return totals;
}
