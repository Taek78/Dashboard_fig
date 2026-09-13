/*
 * Motif d'annulation d'une commande (2026-09-14) : exigé par la Server Action
 * dès que le statut visé est « annulée », stocké sur la commande (l'application
 * du client l'affichera) et dans l'événement d'historique. Clés anglaises,
 * libellés français ; « autre » demande une précision libre, bornée.
 */
export const CANCELLATION_REASONS = ["stock", "delivery", "other"] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  stock: "Stock insuffisant",
  delivery: "Livraison indisponible",
  other: "Autre",
};

export const CANCELLATION_DETAIL_MAX_LENGTH = 100;

export type Cancellation = {
  reason: CancellationReason;
  /** Précision libre, seulement pour « autre » (100 caractères au plus). */
  detail: string | null;
};

/** "Stock insuffisant" ; "Autre : client absent". */
export function formatCancellation(cancellation: Cancellation): string {
  const label = CANCELLATION_REASON_LABELS[cancellation.reason];
  return cancellation.detail ? `${label} : ${cancellation.detail}` : label;
}
