/*
 * Motif d'annulation d'une commande : exigé par la Server Action
 * dès que le statut visé est « annulée », stocké sur la commande (l'application
 * du client l'affichera) et dans l'événement d'historique. Clés anglaises,
 * libellés français ; « autre » demande une précision libre, bornée.
 * « customer » (2026-09-17) : la personne a annulé elle-même depuis
 * l'application (API), tant que la commande était en préparation ; la
 * précision est son explication, facultative. L'équipe peut aussi le choisir
 * pour une annulation demandée par téléphone.
 */
export const CANCELLATION_REASONS = [
  "stock",
  "delivery",
  "customer",
  "other",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  stock: "Stock insuffisant",
  delivery: "Livraison indisponible",
  customer: "Annulée par le client",
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
