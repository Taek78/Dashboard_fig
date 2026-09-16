/*
 * Remise d'une communauté, décidée par le NOMBRE DE MEMBRES (décision du
 * client, 2026-09-16) : rien jusqu'à trois membres, −5 % de quatre à neuf,
 * −10 % à partir de dix. Le taux n'est plus stocké (colonne discount_percent
 * supprimée en 0009) : il se déduit des adhésions, que l'application gère.
 * Le montant réellement déduit reste celui du paiement dans l'application
 * (Order.discount) ; ce taux est ce que le dashboard ANNONCE.
 * Toutes les communautés ont la livraison offerte (orders/delivery-fee.ts).
 */
export const COMMUNITY_DISCOUNT_TIERS = [
  { minMembers: 10, percent: 10 },
  { minMembers: 4, percent: 5 },
  { minMembers: 0, percent: 0 },
] as const;

export type CommunityDiscountTier = (typeof COMMUNITY_DISCOUNT_TIERS)[number];

/** Taux annoncé pour un nombre de membres (entier ≥ 0). */
export function communityDiscountPercent(memberCount: number): number {
  const tier = COMMUNITY_DISCOUNT_TIERS.find(
    (t) => memberCount >= t.minMembers,
  );
  return tier?.percent ?? 0;
}

/** Palier suivant à atteindre, ou null quand la communauté est au taux maximal. */
export function nextCommunityDiscountTier(
  memberCount: number,
): CommunityDiscountTier | null {
  const above = COMMUNITY_DISCOUNT_TIERS.filter(
    (t) => t.minMembers > memberCount,
  );
  return above.at(-1) ?? null;
}
